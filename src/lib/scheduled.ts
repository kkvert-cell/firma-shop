// Автоматическая синхронизация по расписанию (Cloudflare Cron Trigger, каждые 5 минут).
// Каждый запуск: порция остатков из KeyCRM (с запоминанием места); раз в 3 часа — ещё и артикулы из Prom.
// Только относительные импорты: этот файл собирается отдельно от Next.js.

import { getSql } from "./db";
import type { Run } from "./catalog";
import { syncStockChunk } from "./keycrm-sync";
import { linkArticles } from "./prom-articles";
import { retryPendingOrders } from "./keycrm-orders";
import { getState, setState } from "./sync-state";

const PAGES_PER_RUN = 20; // 20 страниц KeyCRM + запросы к базе — в пределах лимита запросов одного запуска
const ORDERS_PER_RUN = 3; // сколько заказов за раз добираем в KeyCRM
const REQUESTS_PER_ORDER = 7; // примерно столько внешних запросов уходит на один заказ

export async function runScheduled(now: Date = new Date()) {
  const run = getSql() as unknown as Run;
  const runTs = now.toISOString().replace("T", " ").slice(0, 19);

  // 0) Заказы с сайта, которые ещё не попали в KeyCRM (повторные попытки)
  let pages = PAGES_PER_RUN;
  if (process.env.KEYCRM_API_KEY) {
    try {
      const o = await retryPendingOrders(run, ORDERS_PER_RUN);
      if (o.tried) {
        console.log(`[cron] Замовлення в KeyCRM: спроб ${o.tried}, передано ${o.sent}`);
        // каждый заказ расходует часть лимита внешних запросов — остаткам оставляем меньше страниц
        pages = Math.max(5, PAGES_PER_RUN - REQUESTS_PER_ORDER * o.tried);
      }
    } catch (err) {
      console.error("[cron] Помилка передачі замовлень у KeyCRM:", err);
    }
  }

  // 1) Остатки из KeyCRM
  if (process.env.KEYCRM_API_KEY) {
    try {
      const cursor = Math.max(1, Number(await getState(run, "keycrm_page")) || 1);
      const r = await syncStockChunk(run, { startPage: cursor, maxPages: pages, runTs });
      await setState(run, "keycrm_page", String(r.nextPage ?? 1));
      await setState(run, "keycrm_last_run", runTs);
      console.log(`[cron] KeyCRM: стр. ${r.fromPage}+${r.pagesDone}/${r.totalPages}, збіглося ${r.matched}, змінилось ${r.changed}${r.error ? ", помилка: " + r.error : ""}`);
    } catch (err) {
      console.error("[cron] Помилка синхронізації залишків:", err);
    }
  }

  // 2) Артикули из Prom — раз в 3 часа (в первые 5 минут часа)
  if (process.env.PROM_YML_URL && now.getUTCHours() % 3 === 0 && now.getUTCMinutes() < 5) {
    try {
      const r = await linkArticles(run, process.env.PROM_YML_URL);
      console.log(`[cron] Артикули: у фіді ${r.offers}, знайдено ${r.found}, змінилось ${r.changed}`);
    } catch (err) {
      console.error("[cron] Помилка синхронізації артикулів:", err);
    }
  }
}
