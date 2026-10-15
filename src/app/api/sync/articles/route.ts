// Підтягує артикули товарів з YML-фіду Prom (products_feed.xml) у базу.
//   /api/sync/articles?key=<SYNC_SECRET>
// Секрети: PROM_YML_URL (посилання на products_feed.xml), SYNC_SECRET.

import { NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import type { Run } from "@/lib/catalog";
import { linkArticles } from "@/lib/prom-articles";
import { checkKey, esc, htmlPage } from "@/lib/sync-page";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkKey(req);
  if (denied) return denied;
  const feedUrl = process.env.PROM_YML_URL;
  if (!feedUrl) return htmlPage("<h3>Не задано PROM_YML_URL</h3><p>Додайте секрет у Cloudflare (посилання на products_feed.xml).</p>", 500);

  try {
    const r = await linkArticles(getSql() as unknown as Run, feedUrl);
    const key = encodeURIComponent(req.nextUrl.searchParams.get("key") ?? "");
    return htmlPage(`<h3>Готово ✅</h3>
      <p>Товарів у фіді: ${r.offers}. Знайдено артикулів: ${r.found}. Оновлено в базі: ${r.changed}.</p>
      <p><a href="/api/sync/keycrm?key=${key}" style="font-size:20px">Далі: залишки з KeyCRM →</a></p>`);
  } catch (e) {
    return htmlPage(`<h3>Помилка</h3><pre style="white-space:pre-wrap">${esc(e instanceof Error ? e.message : String(e))}</pre>`, 500);
  }
}
