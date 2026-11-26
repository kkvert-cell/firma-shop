// Автоматическая синхронизация по расписанию (Cloudflare Cron Triggers). Расписание и причины — в cron-plan.ts.
//   runScheduled   (:00 и :30) — добор заказов в KeyCRM, порция остатков KeyCRM, акции
//   runPromRefresh (:01 и :31) — каталог Prom порциями (дважды в сутки), YML раз в 6 часов
// Между окнами база Neon не получает ни одного запроса и может засыпать (scale to zero).
// Только относительные импорты: этот файл собирается отдельно от Next.js.

import { getSql } from "./db";
import type { Run } from "./catalog";
import { syncStockChunk } from "./keycrm-sync";
import { syncYml } from "./prom-groups";
import { retryPendingOrders } from "./keycrm-orders";
import { getStates, setState, setStates } from "./sync-state";
import { promRefreshStep } from "./prom-refresh";
import { healRun } from "./schema-heal";
import { maintainSales } from "./sales";
import { CRON_PROM, CRON_STOCK, ymlDue } from "./cron-plan";
import { withLock } from "./task-lock";

export { CRON_PROM, CRON_STOCK };

// Синхронизации товаров (каталог Prom, YML, остатки KeyCRM, обслуживание акций) выполняются только при SYNC_ENABLED=on.
// Без этой настройки cron ничего не меняет в товарах и ценах; добор заказов в KeyCRM работает всегда.
const syncEnabled = () => process.env.SYNC_ENABLED === "on";

export async function runPromRefresh(now: Date = new Date()) {
  if (!syncEnabled()) return;
  const feedUrl = process.env.PROM_FEED_URL;
  const ymlUrl = process.env.PROM_YML_URL;
  if (!feedUrl && !ymlUrl) return;
  const run = healRun(getSql() as unknown as Run);

  // Одно чтение состояния на весь запуск
  let st: Record<string, string>;
  try {
    st = await getStates(run, ["prom_refresh", "catalog_mode", "yml_last_run"]);
  } catch (err) {
    console.error("[cron] Не вдалося прочитати стан синхронізації:", err);
    return;
  }

  let idle = true;
  if (feedUrl) {
    try {
      const r = await promRefreshStep(run, feedUrl, now, { preload: st });
      if (r.status !== "idle" && r.status !== "busy") {
        console.log("[cron] Каталог Prom:", JSON.stringify(r));
        idle = false;
      }
      if (r.status === "busy") idle = false;
    } catch (err) {
      console.error("[cron] Помилка оновлення каталогу Prom:", err);
      idle = false;
    }
  }

  // Артикули й групи продавця з YML — раз на 6 годин, лише коли оновлення каталогу не йде (щоб не перевищити ліміт запитів за запуск)
  if (ymlUrl && idle) {
    try {
      const last = st["yml_last_run"] ? new Date(st["yml_last_run"]) : null;
      if (ymlDue(last && !Number.isNaN(last.getTime()) ? last : null, now)) {
        await setState(run, "yml_last_run", now.toISOString());
        const r = await syncYml(run, ymlUrl);
        if (r) console.log(`[cron] YML: товарів ${r.offers}, артикулів ${r.found}/${r.changed}, групи: ${JSON.stringify(r.groups)}`);
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

  // 0) Заказы с сайта, которые ещё не попали в KeyCRM (страховка: основная отправка идёт сразу при оформлении)
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

  if (!syncEnabled()) {
    console.log("[cron] Синхронізацію товарів вимкнено (SYNC_ENABLED не дорівнює on): залишки, акції й каталог не змінюються");
    return;
  }

  // 1) Остатки из KeyCRM (замок внутри syncStockChunk)
  if (process.env.KEYCRM_API_KEY) {
    try {
      const st = await getStates(run, ["keycrm_page"]);
      const cursor = Math.max(1, Number(st["keycrm_page"]) || 1);
      const r = await syncStockChunk(run, { startPage: cursor, maxPages: pages, runTs });
      if (r.busy) console.log("[cron] KeyCRM: синхронізація вже виконується, пропускаємо");
      else {
        await setStates(run, { keycrm_page: String(r.nextPage ?? 1), keycrm_last_run: runTs });
        console.log(`[cron] KeyCRM: стр. ${r.fromPage}+${r.pagesDone}/${r.totalPages}, збіглося ${r.matched}, змінилось ${r.changed}${r.error ? ", помилка: " + r.error : ""}`);
      }
    } catch (err) {
      console.error("[cron] Помилка синхронізації залишків:", err);
    }
  }

  // 2) Акції: завершення за строком, нові строки, історія цін. Запускається в кожному вікні (раз на 30 хв), у тому числі о 00:00 за Києвом
  try {
    const l = await withLock(run, "sales", 5 * 60_000, () => maintainSales(healRun(run)));
    if (l.ran && (l.value.ended || l.value.started || l.value.cleared)) console.log("[cron] Акції:", JSON.stringify(l.value));
  } catch (err) {
    console.error("[cron] Помилка обслуговування акцій:", err);
  }
}
