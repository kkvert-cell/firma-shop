// Вхід в адмінку за паролем (секрет ADMIN_PASSWORD у Cloudflare, тип Secret).
// Після входу в браузері зберігається підписаний «пропуск» на 14 днів (cookie, недоступний скриптам).
// Підпис залежить від пароля: змінили пароль — усі старі пропуски перестали діяти.
// Без ADMIN_PASSWORD адмінка повністю вимкнена.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { Run } from "./catalog";
import { getState, setState } from "./sync-state";

export const COOKIE = "firma_admin";
const DAYS = 14;

const secret = () => (process.env.ADMIN_PASSWORD ?? "").trim();
export const adminEnabled = () => secret().length >= 8;

const sign = (payload: string) => createHmac("sha256", secret()).update("firma-admin|" + payload).digest("hex");

const sha = (s: string) => createHash("sha256").update(s).digest();
const safeEq = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

export const checkPassword = (input: string) => adminEnabled() && safeEq(input, secret());

export function makeSession(): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: DAYS * 86400 };
}

export function verifySession(token: string | undefined | null): boolean {
  if (!adminEnabled() || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEq(sig, sign(exp));
}

export async function isAdmin(): Promise<boolean> {
  return verifySession((await cookies()).get(COOKIE)?.value);
}

// Для сторінок: якщо не увійшли — на форму входу
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

// Для POST-запитів: пропуск є і запит прийшов з нашого ж сайту
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // браузер не надіслав Origin (звичайна навігація)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function apiAdminOk(req: NextRequest): boolean {
  return verifySession(req.cookies.get(COOKIE)?.value) && sameOrigin(req);
}

// Захист від підбору пароля: після 8 помилок поспіль вхід блокується на 15 хвилин
const KEY = "admin_login_fail";
const MAX_FAILS = 8;
const LOCK_MIN = 15;

export async function loginLocked(run: Run): Promise<boolean> {
  const v = await getState(run, KEY);
  if (!v) return false;
  const [n, ts] = v.split("|").map(Number);
  return n >= MAX_FAILS && Date.now() - ts < LOCK_MIN * 60_000;
}

export async function recordLoginFail(run: Run): Promise<void> {
  const v = await getState(run, KEY);
  const [n, ts] = (v ?? "0|0").split("|").map(Number);
  const fresh = Date.now() - ts > LOCK_MIN * 60_000;
  await setState(run, KEY, `${fresh ? 1 : n + 1}|${Date.now()}`);
}

export async function clearLoginFails(run: Run): Promise<void> {
  await setState(run, KEY, "0|0");
}
