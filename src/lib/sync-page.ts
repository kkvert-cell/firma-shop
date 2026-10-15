// Общие мелочи для служебных страниц синхронизации (доступ по секретному слову).
import type { NextRequest } from "next/server";

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const htmlPage = (body: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;max-width:680px;margin:40px auto;padding:0 16px;line-height:1.5">${body}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );

// Возвращает готовый ответ-отказ, если секретное слово не совпало; иначе null.
export function checkKey(req: NextRequest): Response | null {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return htmlPage("<h3>SYNC_SECRET не заданий на сервері</h3>", 500);
  if ((req.nextUrl.searchParams.get("key") ?? "") !== secret) return htmlPage("<h3>Доступ заборонено</h3>", 403);
  return null;
}
