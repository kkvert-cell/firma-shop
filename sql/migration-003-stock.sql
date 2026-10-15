-- Миграция 003: остатки из KeyCRM и связка товаров по артикулу.
-- Выполнить ОДИН раз в Neon SQL Editor (безопасно повторять — везде IF NOT EXISTS).

-- Когда остаток товара последний раз приходил из KeyCRM (пусто = точного остатка ещё нет)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockSyncedAt" TIMESTAMP;

-- Артикул не обязан быть уникальным (бывает, что у двух карточек один артикул) —
-- тогда у обеих будет один и тот же остаток со склада.
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_vendorCode_key";
CREATE INDEX IF NOT EXISTS "Product_vendorCode_idx" ON "Product" ("vendorCode");

-- Служебная таблица: на каком месте остановилась автоматическая синхронизация
CREATE TABLE IF NOT EXISTS "SyncState" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
