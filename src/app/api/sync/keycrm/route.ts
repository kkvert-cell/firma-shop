// Остатки из KeyCRM: ручной запуск и просмотр состояния.
//   /api/sync/keycrm?key=<SYNC_SECRET>             — обработать порцию (до 20 страниц KeyCRM) и показать итоги
//   /api/sync/keycrm?key=<SYNC_SECRET>&status=1    — только показать состояние, ничего не запускать
// Секреты (Cloudflare → Variables and secrets): KEYCRM_API_KEY, SYNC_SECRET.

import { NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import type { Run } from "@/lib/catalog";
import { getStockStats, syncStockChunk } from "@/lib/keycrm-sync";
import { getState } from "@/lib/sync-state";
import { checkKey, esc, htmlPage } from "@/lib/sync-page";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkKey(req);
  if (denied) return denied;
  if (!process.env.KEYCRM_API_KEY) return htmlPage("<h3>Не задано KEYCRM_API_KEY</h3><p>Додайте секрет у Cloudflare.</p>", 500);

  const p = req.nextUrl.searchParams;
  const key = p.get("key") ?? "";
  const startPage = Math.max(1, Number(p.get("page") ?? 1) || 1);
  const maxPages = Math.min(20, Math.max(1, Number(p.get("pages") ?? 20) || 20));
  const run = getSql() as unknown as Run;

  try {
    let head = "";
    let next: string | null = null;

    if (p.get("status") !== "1") {
      const runTs = new Date().toISOString().replace("T", " ").slice(0, 19);
      const r = await syncStockChunk(run, { startPage, maxPages, runTs });
      head = `<h3>${r.nextPage === null && !r.error ? "Готово ✅" : "Оброблено частину"}</h3>
        <p>Сторінки KeyCRM: ${r.fromPage}–${r.fromPage + r.pagesDone - 1} із ${r.totalPages}. Позицій отримано: ${r.offersSeen}, збіглося з товарами на сайті: ${r.matched}, змінилось: ${r.changed}.</p>
        ${r.error ? `<p style="color:#b00">${esc(r.error)}</p>` : ""}`;
      if (r.nextPage !== null) {
        next = `/api/sync/keycrm?key=${encodeURIComponent(key)}&page=${r.nextPage}`;
        head += `<p><a href="${esc(next)}" style="font-size:20px">Продовжити →</a></p>`;
      }
    }

    const [stats, lastRun, cursor] = await Promise.all([
      getStockStats(run),
      getState(run, "keycrm_last_run").catch(() => null),
      getState(run, "keycrm_page").catch(() => null),
    ]);
    const samples = stats.unmatchedSamples.length
      ? `<p>Артикули, яких немає в KeyCRM (перші 10):</p><ul>${stats.unmatchedSamples.map((s) => `<li>${esc(s.code)} — ${esc(s.name)}</li>`).join("")}</ul>`
      : "";

    return htmlPage(`${head}
      <h4>Стан</h4>
      <ul>
        <li>Товарів на сайті: ${stats.total}</li>
        <li>З артикулом: ${stats.withCode}</li>
        <li>Отримали залишок із KeyCRM: ${stats.synced}</li>
        <li>Автооновлення: остання порція ${lastRun ? esc(lastRun) + " UTC" : "ще не запускалась"}${cursor ? `, наступна сторінка ${esc(cursor)}` : ""}</li>
      </ul>${samples}`);
  } catch (e) {
    return htmlPage(`<h3>Помилка</h3><pre style="white-space:pre-wrap">${esc(e instanceof Error ? e.message : String(e))}</pre>`, 500);
  }
}
