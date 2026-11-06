// Страховка на случай, если новую версию сайта залили раньше, чем выполнили SQL-миграцию:
// при первой ошибке «нет такой колонки» добавляем недостающие колонки сами (операции безопасные и повторяемые)
// и повторяем запрос. Файлы sql/migration-007-… и 008-… делают то же самое вручную.

import type { Run } from "./catalog";

const STATEMENTS = [
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "homeFlags" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleStartsAt" TIMESTAMPTZ`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleEndsAt" TIMESTAMPTZ`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleEndedPrice" NUMERIC(12,2)`,
  `CREATE TABLE IF NOT EXISTS "PriceLog" ("id" BIGSERIAL PRIMARY KEY, "productId" TEXT NOT NULL, "price" NUMERIC(12,2) NOT NULL, "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS "PriceLog_product_time_idx" ON "PriceLog" ("productId", "recordedAt" DESC)`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "promId" TEXT UNIQUE`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameSource" TEXT`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameAuto" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'legacy'`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "inFeed" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "groupId" TEXT`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "legacyCategoryId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Product_groupId_idx" ON "Product" ("groupId")`,
];

const needsMigration = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /does not exist/i.test(m) && /(isHidden|lockedFields|homeFlags|saleStartsAt|saleEndsAt|saleEndedPrice|PriceLog|promId|nameSource|nameAuto|inFeed|imageUrl|groupId|legacyCategoryId|source)/.test(m);
};

let healing: Promise<void> | null = null;

export function healRun(run: Run): Run {
  return async (q, p) => {
    try {
      return await run(q, p);
    } catch (e) {
      if (!needsMigration(e)) throw e;
      healing ??= (async () => {
        for (const s of STATEMENTS) await run(s, []);
      })().finally(() => {
        healing = null;
      });
      await healing;
      return run(q, p);
    }
  };
}
