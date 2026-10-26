-- Миграция 006: коды города и отделения Новой почты в доставке заказа.
-- Выполнить ОДИН раз в Neon SQL Editor (повторный запуск безопасен).
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "cityRef" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "warehouseRef" TEXT;
