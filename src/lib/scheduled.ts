// Автоматическая синхронизация по расписанию (Cloudflare Cron Trigger, каждые 5 минут).
// Каждый запуск: порция остатков из KeyCRM (с запоминанием места). Артикулы и группы из YML Prom — раз в час, в «Prom-запуске» (runPromRefresh).
// Только относительные импорты: этот файл собирается отдельно от Next.js.

import { getSql } from "./db";
import type { Run } from "./catalog";
import { syncStockChunk } from "./keycrm-sync";
import { syncYml } from "./prom-groups";
import { retryPendingOrders } from "./keycrm-orders";
import { getState, setState } from "./sync-state";
import { promRefreshStep } from "./prom-refresh";
import { healRun } from "./schema-heal";
import { maintainSales } from "./sales";

// Другий розклад: оновлення каталогу з Prom (окремим запуском, щоб не ділити ліміти із залишками й замовленнями).
// Той самий рядок має стояти в wrangler.json → triggers.crons.
export const PROM_CRON = "2,12,22,32,42,52 * * * *";

export async function runPromRefresh(now: Date = new Date()) {
  // Акції: завершення за строком, нові строки, історія цін (працює і без фіда Prom)
  try {
    const m = await maintainSales(healRun(getSql() as unknown as Run));
    if (m.ended || m.started || m.cleared) console.log("[cron] Акції:", JSON.stringify(m));
  } catch (err) {
    console.error("[cron] Помилка обслуговування акцій:", err);
  }
  const feedUrl = process.env.PROM_FEED_URL;
  let idle = true;
  if (feedUrl) {
    try {
      const r = await promRefreshStep(healRun(getSql() as unknown as Run), feedUrl, now, Number(process.env.PROM_REFRESH_HOURS) || 12);
      if (r.status !== "idle") {
        console.log("[cron] Каталог Prom:", JSON.stringify(r));
        idle = false;
      }
    } catch (err) {
      console.error("[cron] Помилка оновлення каталогу Prom:", err);
      idle = false;
    }
  }

  // Артикули й групи продавця з YML — раз на годину, лише коли оновлення каталогу не йде (щоб не перевищити ліміт запитів за запуск)
  const ymlUrl = process.env.PROM_YML_URL;
  if (ymlUrl && idle) {
    try {
      const run = healRun(getSql() as unknown as Run);
      const last = Date.parse((await getState(run, "yml_last_run")) ?? "") || 0;
      if (now.getTime() - last > 55 * 60_000) {
        await setState(run, "yml_last_run", now.toISOString());
        const r = await syncYml(run, ymlUrl);
        console.log(`[cron] YML: товарів ${r.offers}, артикулів ${r.found}/${r.changed}, групи: ${JSON.stringify(r.groups)}`);
      }
    } catch (err) {
      console.error("[cron] Помилка синхронізації YML:", err);
    }
  }
}

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
}
