-- Особистий кабінет: профіль покупця та збережені адреси доставки.
-- Виконувати вручну не обов'язково: сайт сам створює ці таблиці при першому відкритті кабінету (команди безпечні й повторювані).
CREATE TABLE IF NOT EXISTS "Customer" (
  email TEXT PRIMARY KEY,
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "CustomerAddress" (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  carrier TEXT NOT NULL,
  city TEXT NOT NULL,
  "cityRef" TEXT,
  warehouse TEXT NOT NULL,
  "warehouseRef" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CustomerAddress_email_idx" ON "CustomerAddress" (email);
