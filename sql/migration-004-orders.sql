-- Миграция 004: заказы с сайта. Выполнить ОДИН раз в Neon SQL Editor (безопасно повторять).

-- Номера заказов: F-10001, F-10002, ...
CREATE SEQUENCE IF NOT EXISTS "OrderNumberSeq" START 10001;

-- Защита от двойной отправки формы и "секретная ссылка" на страницу подтверждения заказа
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_clientToken_key" ON "Order" ("clientToken");

-- Для передачи заказов в KeyCRM (следующий этап)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "keycrmOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "keycrmSyncedAt" TIMESTAMP;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "keycrmError" TEXT;
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order" ("createdAt");

-- Название и артикул товара на момент заказа (название потом может измениться)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "vendorCode" TEXT;
