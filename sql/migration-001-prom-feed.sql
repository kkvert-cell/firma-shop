-- Миграция 001: поля для загрузки товаров из фида Прома.
-- Выполнить ОДИН раз в Neon SQL Editor (после schema.sql и seed.sql).

ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "externalId" TEXT UNIQUE;   -- id товара на Проме
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "vendorCode" TEXT UNIQUE;   -- артикул — для звірки з KeyCRM
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "sourceUrl"  TEXT;          -- ссылка на товар на Проме
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "syncedAt"   TIMESTAMP;     -- когда товар последний раз был в фиде
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "path" TEXT UNIQUE; -- полный путь категории из фида

-- Категории с одинаковым коротким именем, но в разных ветках дерева
-- (например "Аксесуари" у інструментів і в авто-товарах) — это нормально.
-- Уникальным должен быть весь путь, а не короткий slug.
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_slug_key";
CREATE INDEX IF NOT EXISTS "Category_slug_idx" ON "Category"("slug");

-- 11 «пробных» категорий из seed.sql заменяются деревом категорий из фида:
-- прячем их (не удаляем), чтобы на сайте не было пустых разделов.
UPDATE "Category" SET "isActive" = false WHERE "path" IS NULL;
