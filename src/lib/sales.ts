// Акції зі строками дії. Правила (відповідають Закону «Про рекламу» та новому Закону «Про захист прав споживачів»):
//  • знижка показується лише поки діє: є стара ціна, настав початок і не минув кінець;
//  • після кінця строку ціна повертається до звичайної, а знижка зникає з сайту;
//  • «звичайна ціна» для нової акції = найнижча ціна, за якою товар продавався за останні 30 днів (історія цін).
// Тільки відносні імпорти: файл використовується в cron-воркері.

import type { Run } from "./catalog";

export const SALE_DEFAULT_DAYS = 14; // строк за замовчуванням для знижок, що прийшли з Prom без дат
export const SALE_HISTORY_DAYS = 30;

// SQL-умова «акція зараз діє» для таблиці з псевдонімом p
export const SALE_ACTIVE = `(p."oldPrice" > p.price AND p."saleEndsAt" > now() AND (p."saleStartsAt" IS NULL OR p."saleStartsAt" <= now()))`;
// Стара ціна для показу покупцям: лише поки акція діє
export const OLD_PRICE_SQL = `(CASE WHEN ${SALE_ACTIVE} THEN p."oldPrice" END)::float8 AS "oldPrice"`;
// Дата кінця акції, текстом ДД.ММ.РРРР (за київським часом), лише поки акція діє
export const SALE_UNTIL_SQL = `(CASE WHEN ${SALE_ACTIVE} THEN to_char(p."saleEndsAt" AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YYYY') END) AS "saleUntil"`;

// Кінець дня за Києвом для дати РРРР-ММ-ДД (параметр $n має бути текстом дати)
export const endOfDayKyiv = (n: number) => `((($${n}::date) + time '23:59:59') AT TIME ZONE 'Europe/Kyiv')`;
export const startOfDayKyiv = (n: number) => `(($${n}::date)::timestamp AT TIME ZONE 'Europe/Kyiv')`;

// Записує поточну ціну товару в історію, якщо вона відрізняється від останньої записаної
export async function logPrice(run: Run, productId: string): Promise<void> {
  await run(
    `INSERT INTO "PriceLog"("productId", price)
     SELECT p.id, p.price FROM "Product" p
      WHERE p.id = $1 AND p.price > 0
        AND p.price IS DISTINCT FROM (SELECT l.price FROM "PriceLog" l WHERE l."productId" = p.id ORDER BY l."recordedAt" DESC, l.id DESC LIMIT 1)`,
    [productId]
  );
}

export type SalesMaintenance = { ended: number; started: number; cleared: number; logged: number };

// Щоденна «прибиральниця» акцій; безпечно запускати часто (кожен крок ідемпотентний).
export async function maintainSales(run: Run, defaultDays = SALE_DEFAULT_DAYS): Promise<SalesMaintenance> {
  const n = (rows: Record<string, unknown>[]) => Number(rows[0]?.n ?? 0);

  // 1. Строк вийшов: повертаємо звичайну ціну, запам'ятовуємо акційну, щоб Prom не повернув її сам
  const ended = n(
    await run(
      `WITH e AS (
         UPDATE "Product" SET "saleEndedPrice" = price, price = "oldPrice", "oldPrice" = NULL,
                "saleStartsAt" = NULL, "saleEndsAt" = NULL, "updatedAt" = now()
          WHERE "saleEndsAt" IS NOT NULL AND "saleEndsAt" <= now() AND "oldPrice" > price
          RETURNING 1)
       SELECT count(*)::int AS n FROM e`
    )
  );

  // 2. Нова знижка без дат (з Prom або старі записи): задаємо строк і звіряємо «стару» ціну з історією за 30 днів
  const started = n(
    await run(
      `WITH s AS (
         UPDATE "Product" p SET "saleStartsAt" = now(), "saleEndsAt" = now() + make_interval(days => $1::int), "saleEndedPrice" = NULL,
                "oldPrice" = LEAST(p."oldPrice", COALESCE((SELECT min(l.price) FROM "PriceLog" l
                                   WHERE l."productId" = p.id AND l."recordedAt" > now() - make_interval(days => ${SALE_HISTORY_DAYS})), p."oldPrice")),
                "updatedAt" = now()
          WHERE p."oldPrice" > p.price AND p."saleEndsAt" IS NULL
            AND (p."saleEndedPrice" IS NULL OR p."saleEndedPrice" <> p.price)
          RETURNING 1)
       SELECT count(*)::int AS n FROM s`,
      [defaultDays]
    )
  );

  // 3. Дати без справжньої знижки (стару ціну прибрали або вона не вища за поточну) — чистимо
  const cleared = n(
    await run(
      `WITH c AS (
         UPDATE "Product" SET "oldPrice" = CASE WHEN "oldPrice" <= price THEN NULL ELSE "oldPrice" END,
                "saleStartsAt" = NULL, "saleEndsAt" = NULL, "updatedAt" = now()
          WHERE ("saleEndsAt" IS NOT NULL OR "saleStartsAt" IS NOT NULL) AND ("oldPrice" IS NULL OR "oldPrice" <= price)
          RETURNING 1)
       SELECT count(*)::int AS n FROM c`
    )
  );

  // 4. Історія цін: записуємо лише зміни
  const logged = n(
    await run(
      `WITH l AS (
         INSERT INTO "PriceLog"("productId", price)
         SELECT p.id, p.price FROM "Product" p
          WHERE p.price > 0
            AND p.price IS DISTINCT FROM (SELECT x.price FROM "PriceLog" x WHERE x."productId" = p.id ORDER BY x."recordedAt" DESC, x.id DESC LIMIT 1)
         RETURNING 1)
       SELECT count(*)::int AS n FROM l`
    )
  );

  return { ended, started, cleared, logged };
}
