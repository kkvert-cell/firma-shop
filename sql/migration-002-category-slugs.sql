-- Миграция 002: делает адреса категорий (slug) уникальными.
-- Нужна на случай, если у двух категорий с очень длинными названиями адрес
-- совпал после обрезки. Безопасно запускать повторно (если дублей нет — ничего не меняет).
-- Выполнить в Neon SQL Editor.

UPDATE "Category" c
SET slug = c.slug || '-' || s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY slug ORDER BY path NULLS LAST, id) AS rn
  FROM "Category"
) s
WHERE c.id = s.id AND s.rn > 1;

-- Для быстрого открытия страниц каталога
CREATE INDEX IF NOT EXISTS "ProductImage_productId_sortOrder_idx" ON "ProductImage" ("productId", "sortOrder");
CREATE INDEX IF NOT EXISTS "Product_isAvailable_idx" ON "Product" ("isAvailable");
