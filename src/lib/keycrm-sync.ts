// Остатки из KeyCRM -> наша база. KeyCRM — главный источник правды по складу.
// Товары сопоставляются по артикулу: Product.vendorCode = sku в KeyCRM.
// Доступно к продаже = quantity - reserve (резерв — уже оформленные, но не отгруженные заказы).

import type { Run } from "./catalog";
import { keycrmGet } from "./keycrm";

type StockRow = { sku: string; quantity: number; reserve: number };

export type ChunkResult = {
  fromPage: number;
  pagesDone: number;
  totalPages: number;
  nextPage: number | null; // null — прошли весь список
  offersSeen: number; // позиций получено из KeyCRM
  matched: number; // из них нашлось товаров на сайте
  changed: number; // у скольких товаров остаток реально изменился
  error: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function applyStocks(run: Run, rows: StockRow[], runTs: string) {
  const res = await run(
    `WITH x AS (
       SELECT sku, sum(quantity) AS q, sum(reserve) AS r
       FROM jsonb_to_recordset($1::jsonb) AS t(sku text, quantity numeric, reserve numeric)
       GROUP BY sku),
     m AS (
       SELECT p.id, GREATEST(x.q - x.r, 0)::int AS qty, (x.q - x.r) > 0 AS avail
       FROM "Product" p JOIN x ON p."vendorCode" = x.sku),
     u AS (
       UPDATE "Product" p
       SET "stockQty" = m.qty, "isAvailable" = m.avail, "stockSyncedAt" = $2::timestamp, "updatedAt" = now()
       FROM m
       WHERE p.id = m.id
         AND (p."stockSyncedAt" IS NULL OR p."stockQty" <> m.qty OR p."isAvailable" <> m.avail)
       RETURNING p.id)
     SELECT (SELECT count(*) FROM m)::int AS matched, (SELECT count(*) FROM u)::int AS changed`,
    [JSON.stringify(rows), runTs]
  );
  return { matched: Number(res[0]?.matched ?? 0), changed: Number(res[0]?.changed ?? 0) };
}

// Обрабатывает не больше maxPages страниц KeyCRM за раз (лимит запросов на один запуск воркера).
export async function syncStockChunk(
  run: Run,
  opts: { startPage: number; maxPages: number; runTs: string; pauseMs?: number }
): Promise<ChunkResult> {
  const rows: StockRow[] = [];
  let page = opts.startPage;
  let totalPages = opts.startPage;
  let pagesDone = 0;
  let error: string | null = null;

  while (pagesDone < opts.maxPages && page <= totalPages) {
    const r = await keycrmGet("/offers/stocks", { limit: 50, page });
    if (r.status === 429) {
      error = "KeyCRM просить трохи зачекати (429) — продовжимо з цього місця наступного разу";
      break;
    }
    if (!r.ok) {
      error = `KeyCRM відповів помилкою ${r.status}`;
      break;
    }
    const body = r.body as { data?: unknown; last_page?: number } | null;
    if (!body || !Array.isArray(body.data)) {
      error = "Несподівана відповідь KeyCRM";
      break;
    }
    totalPages = Number(body.last_page ?? page);
    for (const o of body.data as Record<string, unknown>[]) {
      const sku = o.sku == null ? "" : String(o.sku).trim();
      if (!sku) continue;
      rows.push({ sku, quantity: Number(o.quantity) || 0, reserve: Number(o.reserve) || 0 });
    }
    pagesDone++;
    page++;
    if (page <= totalPages && pagesDone < opts.maxPages) await sleep(opts.pauseMs ?? 250);
  }

  const applied = rows.length ? await applyStocks(run, rows, opts.runTs) : { matched: 0, changed: 0 };
  const finished = !error && page > totalPages;
  return {
    fromPage: opts.startPage,
    pagesDone,
    totalPages,
    nextPage: finished ? null : page,
    offersSeen: rows.length,
    ...applied,
    error,
  };
}

export async function getStockStats(run: Run) {
  const [counts, unmatched] = await Promise.all([
    run(`SELECT count(*)::int AS total, count("vendorCode")::int AS with_code, count("stockSyncedAt")::int AS synced FROM "Product"`),
    run(
      `SELECT name, "vendorCode" FROM "Product"
       WHERE "vendorCode" IS NOT NULL AND "stockSyncedAt" IS NULL ORDER BY name LIMIT 10`
    ),
  ]);
  return {
    total: Number(counts[0]?.total ?? 0),
    withCode: Number(counts[0]?.with_code ?? 0),
    synced: Number(counts[0]?.synced ?? 0),
    unmatchedSamples: unmatched.map((r) => ({ name: String(r.name), code: String(r.vendorCode) })),
  };
}
