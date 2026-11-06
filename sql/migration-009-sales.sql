-- Акції зі строками дії та історія цін (для правила «звичайна ціна = найнижча за останні 30 днів»).
-- Безпечно виконувати повторно. Сайт може додати це й сам, але краще виконати один раз у Neon SQL Editor.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleStartsAt" TIMESTAMPTZ;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleEndsAt" TIMESTAMPTZ;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleEndedPrice" NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS "PriceLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "price" NUMERIC(12,2) NOT NULL,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PriceLog_product_time_idx" ON "PriceLog" ("productId", "recordedAt" DESC);

-- Товари, які вже мають стару ціну (знижку), отримують строк 14 днів від сьогодні.
-- Далі його можна змінити для кожного товару або для всіх разом: Адмінка → Акції.
UPDATE "Product"
   SET "saleStartsAt" = now(), "saleEndsAt" = now() + interval '14 days'
 WHERE "oldPrice" > "price" AND "saleEndsAt" IS NULL;
