-- Миграция 005: передача заказов в KeyCRM. Выполнить ОДИН раз в Neon SQL Editor (повторный запуск безопасен).
-- Уже существующие заказы (тестовые) в KeyCRM автоматически НЕ отправляются.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'keycrmAttempts'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "keycrmAttempts" INT NOT NULL DEFAULT 0;
    UPDATE "Order" SET "keycrmAttempts" = 99 WHERE "keycrmOrderId" IS NULL;
  END IF;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "keycrmTriedAt" TIMESTAMP;
