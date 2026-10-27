// Особистий кабінет покупця: вхід без пароля — за одноразовим посиланням з листа (magic link).
// Потрібні секрети Cloudflare: ACCOUNT_SECRET (довгий випадковий рядок, ≥16 символів) і пошта (RESEND_API_KEY + MAIL_FROM).
// Поки їх немає, кабінет вимкнений, а оформлення замовлень працює без реєстрації, як і раніше.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Run } from "./catalog";
import { getState, setState } from "./sync-state";

export const CUSTOMER_COOKIE = "firma_customer";
const LOGIN_MIN = 15; // посилання з листа діє 15 хвилин
const SESSION_DAYS = 30;

const secret = () => (process.env.ACCOUNT_SECRET ?? "").trim();
export const accountEnabled = () => secret().length >= 16 && !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const sign = (purpose: string, email: string, exp: number) => createHmac("sha256", secret()).update(`${purpose}|${email}|${exp}`).digest("base64url");
const sha = (s: string) => createHash("sha256").update(s).digest();
const eq = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

function make(purpose: "login" | "session", email: string, seconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${b64(email)}.${exp}.${sign(purpose, email, exp)}`;
}

function check(purpose: "login" | "session", token: string | undefined | null): string | null {
  if (!secret() || !token) return null;
  const [e64, exp, sig] = token.split(".");
  if (!e64 || !exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null;
  let email: string;
  try {
    email = unb64(e64);
  } catch {
    return null;
  }
  return eq(sig, sign(purpose, email, Number(exp))) ? email : null;
}

export const makeLoginToken = (email: string) => make("login", email, LOGIN_MIN * 60);
export const verifyLoginToken = (t: string | null | undefined) => check("login", t);
export const makeSessionCookie = (email: string) => ({ value: make("session", email, SESSION_DAYS * 86400), maxAge: SESSION_DAYS * 86400 });

export async function getCustomerEmail(): Promise<string | null> {
  if (!accountEnabled()) return null;
  return check("session", (await cookies()).get(CUSTOMER_COOKIE)?.value);
}

export function customerFromRequest(req: NextRequest): string | null {
  return accountEnabled() ? check("session", req.cookies.get(CUSTOMER_COOKIE)?.value) : null;
}

export function sameOriginPost(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Обмеження частоти: щоб не можна було засипати чужу пошту листами
async function hit(run: Run, key: string, windowMin: number, max: number): Promise<boolean> {
  const v = await getState(run, key);
  const [n, ts] = (v ?? "0|0").split("|").map(Number);
  const fresh = Date.now() - ts > windowMin * 60_000;
  if (!fresh && n >= max) return false;
  await setState(run, key, `${fresh ? 1 : n + 1}|${fresh ? Date.now() : ts}`);
  return true;
}

export async function allowLoginRequest(run: Run, email: string): Promise<boolean> {
  const per = await hit(run, `login_req:${createHash("sha256").update(email).digest("hex").slice(0, 16)}`, 15, 3);
  if (!per) return false;
  return hit(run, "login_req_all", 60, 80);
}
