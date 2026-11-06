-- Миграція 010: власні групи Prom (з YML) замість маркетплейсових категорій.
-- Виконати ОДИН раз у Neon SQL Editor (повторний запуск безпечний). Сайт додасть це й сам при першому зверненні, але краще виконати заздалегідь.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "promId" TEXT UNIQUE;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameSource" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameAuto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "inFeed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "legacyCategoryId" TEXT;
CREATE INDEX IF NOT EXISTS "Product_groupId_idx" ON "Product" ("groupId");
