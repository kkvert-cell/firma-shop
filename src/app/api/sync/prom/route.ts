// Загрузка товаров из фида Prom.ua в базу. Запускается вручную:
//   /api/sync/prom?key=<SYNC_SECRET>
// Фид большой, поэтому товары обрабатываются порциями (по 300 за раз):
// страница показывает ссылку «Продолжить», пока не будет «Готово».
// Секреты (в Cloudflare → Variables and secrets): PROM_FEED_URL, SYNC_SECRET.

import { NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import { parseItem, splitItems } from "@/lib/prom-feed";
import { importItems, markMissing, SqlRunner } from "@/lib/prom-sync";

export const dynamic = "force-dynamic";

const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5">${body}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const secret = process.env.SYNC_SECRET;
  const key = p.get("key") ?? "";
  if (!secret) {
    return page("<h3>SYNC_SECRET не заданий на сервері</h3><p>Перевірте Cloudflare → Variables and secrets → Production.</p>", 500);
  }
  if (key !== secret) {
    return page(
      `<h3>Доступ заборонено</h3>
       <p style="color:#888;font-size:13px">(діагностика: довжина збереженого секрету — ${secret.length}, довжина введеного — ${key.length})</p>`,
      403
    );
  }

  const feedUrl = process.env.PROM_FEED_URL;
  if (!feedUrl) return page("<h3>Не задано PROM_FEED_URL</h3><p>Додайте секрет у Cloudflare (Variables and secrets).</p>", 500);

  const from = Math.max(0, Number(p.get("from") ?? 0) || 0);
  const count = Math.min(500, Math.max(1, Number(p.get("count") ?? 300) || 300));
  const run = p.get("run") ?? new Date().toISOString().replace("T", " ").slice(0, 19);

  try {
    const res = await fetch(feedUrl, { cache: "no-store", headers: { "user-agent": "firma-shop-sync/1.0" } });
    if (!res.ok) return page(`<h3>Фід не відкрився</h3><p>Код відповіді Прома: ${res.status}</p>`, 502);
    const items = splitItems(await res.text());
    const total = items.length;
    if (total === 0) return page("<h3>У фіді немає товарів</h3><p>Перевірте посилання PROM_FEED_URL.</p>", 502);

    const slice = items.slice(from, from + count).map(parseItem).filter((i) => i !== null);
    const sql = getSql() as unknown as SqlRunner;
    const stats = await importItems(sql, slice, run);

    const next = from + count;
    if (next < total) {
      const link = `/api/sync/prom?key=${encodeURIComponent(key)}&from=${next}&count=${count}&run=${encodeURIComponent(run)}`;
      return page(
        `<h3>Оброблено ${Math.min(next, total)} із ${total}</h3>
         <p>У цій порції: товарів ${stats.products}, фото ${stats.images}, категорій ${stats.categories}.</p>
         <p><a href="${esc(link)}" style="font-size:20px">Продовжити →</a></p>`
      );
    }
    const hidden = await markMissing(sql, run);
    return page(
      `<h3>Готово ✅</h3><p>Усього товарів у фіді: ${total}.</p>
       <p>Позначено «немає в наявності» товарів, яких вже немає у фіді: ${hidden}.</p>`
    );
  } catch (e) {
    return page(`<h3>Помилка</h3><pre style="white-space:pre-wrap">${esc(e instanceof Error ? e.message : String(e))}</pre>`, 500);
  }
}
