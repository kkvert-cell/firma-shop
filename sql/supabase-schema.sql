-- Полная структура базы интернет-магазина для НОВОЙ пустой базы (Supabase).
-- Собрана из prisma/schema.prisma (базовые таблицы) и sql/migration-001…011. Выполняется ОДИН раз в SQL Editor пустого проекта.
-- Внутри одна транзакция: если что-то пойдёт не так, ничего не применится.
-- ВАЖНО: боевая структура Neon может отличаться мелочами (в репозитории нет исходного schema.sql). Когда Neon снова станет доступен,
-- структуру нужно сверить командой pg_dump --schema-only и поправить различия.
-- После этого файла обязательно выполнить sql/supabase-security.sql (закрывает таблицы от публичного API Supabase).

BEGIN;

-- ---- Базовые таблицы (из prisma/schema.prisma) ----
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'COMPANY_REP', 'ADMIN', 'MANAGER');
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "ShipmentCarrier" AS ENUM ('NOVA_POSHTA', 'SAT', 'UKRPOSHTA', 'OTHER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'BANK_TRANSFER', 'ONLINE_CARD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT,
  "phone" TEXT,
  "passwordHash" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "companyId" TEXT,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email"),
  CONSTRAINT "User_phone_key" UNIQUE ("phone")
);

CREATE TABLE "Company" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "edrpou" TEXT,
  "legalAddress" TEXT,
  "contactPerson" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Address" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "npWarehouse" TEXT,
  "street" TEXT,
  "label" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "parentId" TEXT,
  "description" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_slug_key" UNIQUE ("slug")
);

CREATE TABLE "Brand" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Brand_name_key" UNIQUE ("name"),
  CONSTRAINT "Brand_slug_key" UNIQUE ("slug")
);

CREATE TABLE "Attribute" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "unit" TEXT,
  "type" "AttributeType" NOT NULL DEFAULT 'TEXT',
  CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Attribute_slug_key" UNIQUE ("slug")
);

CREATE TABLE "AttributeValue" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "attributeId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttributeValue_attributeId_value_key" UNIQUE ("attributeId", "value")
);

CREATE TABLE "CategoryAttribute" (
  "categoryId" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "isFilterable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("categoryId", "attributeId")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sku" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "categoryId" TEXT NOT NULL,
  "brandId" TEXT,
  "price" NUMERIC(10,2) NOT NULL,
  "oldPrice" NUMERIC(10,2),
  "currency" TEXT NOT NULL DEFAULT 'UAH',
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_sku_key" UNIQUE ("sku"),
  CONSTRAINT "Product_slug_key" UNIQUE ("slug")
);

CREATE TABLE "ProductAttributeValue" (
  "productId" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "valueId" TEXT,
  "freeText" TEXT,
  CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("productId", "attributeId")
);

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" NUMERIC(10,2),
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_sku_key" UNIQUE ("sku")
);

CREATE TABLE "ProductImage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "altText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "sessionId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cart_userId_key" UNIQUE ("userId"),
  CONSTRAINT "Cart_sessionId_key" UNIQUE ("sessionId")
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_cartId_productId_key" UNIQUE ("cartId", "productId")
);

CREATE TABLE "WishlistItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "sessionId" TEXT,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WishlistItem_userId_productId_key" UNIQUE ("userId", "productId")
);

CREATE TABLE "CompareItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "sessionId" TEXT,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompareItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecentlyViewed" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "sessionId" TEXT,
  "productId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecentlyViewed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderNumber" TEXT NOT NULL,
  "userId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
  "totalAmount" NUMERIC(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UAH',
  "comment" TEXT,
  "promoCodeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_orderNumber_key" UNIQUE ("orderNumber")
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price" NUMERIC(10,2) NOT NULL,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "carrier" "ShipmentCarrier" NOT NULL,
  "warehouse" TEXT,
  "trackingId" TEXT,
  "city" TEXT NOT NULL,
  "status" TEXT,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Shipment_orderId_key" UNIQUE ("orderId")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "providerRef" TEXT,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_orderId_key" UNIQUE ("orderId")
);

CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "discountPct" NUMERIC(5,2),
  "discountFixed" NUMERIC(10,2),
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageLimit" INTEGER,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoCode_code_key" UNIQUE ("code")
);

CREATE TABLE "InvoiceRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "comment" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  "userId" TEXT,
  "authorName" TEXT,
  "rating" INTEGER NOT NULL,
  "text" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Redirect" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "oldPath" TEXT NOT NULL,
  "productId" TEXT,
  "newPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Redirect_oldPath_key" UNIQUE ("oldPath")
);

CREATE TABLE "CmsPage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CmsPage_slug_key" UNIQUE ("slug")
);

ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "AttributeValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompareItem" ADD CONSTRAINT "CompareItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompareItem" ADD CONSTRAINT "CompareItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecentlyViewed" ADD CONSTRAINT "RecentlyViewed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecentlyViewed" ADD CONSTRAINT "RecentlyViewed_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_companyId_idx" ON "User" ("companyId");
CREATE INDEX "Address_userId_idx" ON "Address" ("userId");
CREATE INDEX "Category_parentId_idx" ON "Category" ("parentId");
CREATE INDEX "Category_slug_idx" ON "Category" ("slug");
CREATE INDEX "Product_categoryId_idx" ON "Product" ("categoryId");
CREATE INDEX "Product_brandId_idx" ON "Product" ("brandId");
CREATE INDEX "Product_sku_idx" ON "Product" ("sku");
CREATE INDEX "ProductAttributeValue_valueId_idx" ON "ProductAttributeValue" ("valueId");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant" ("productId");
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage" ("productId");
CREATE INDEX "Order_userId_idx" ON "Order" ("userId");
CREATE INDEX "Order_status_idx" ON "Order" ("status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem" ("orderId");
CREATE INDEX "Shipment_trackingId_idx" ON "Shipment" ("trackingId");
CREATE INDEX "Review_productId_idx" ON "Review" ("productId");

-- ---- migration-001-prom-feed.sql ----
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

-- ---- migration-002-category-slugs.sql ----
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

-- ---- migration-003-stock.sql ----
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

-- ---- migration-004-orders.sql ----
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

-- ---- migration-005-keycrm-orders.sql ----
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

-- ---- migration-006-np-refs.sql ----
-- Миграция 006: коды города и отделения Новой почты в доставке заказа.
-- Выполнить ОДИН раз в Neon SQL Editor (повторный запуск безопасен).
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "cityRef" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "warehouseRef" TEXT;

-- ---- migration-007-admin-edit.sql ----
-- Миграция 007: редактирование каталога в админке.
-- Выполнить ОДИН раз в Neon SQL Editor (повторный запуск безопасен).
-- Если забудете — сайт сам добавит эти колонки при первом обращении, но лучше выполнить заранее.

-- скрыть товар на сайте (без удаления)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
-- какие поля товара изменены вручную и не должны перезаписываться автообновлением из Prom
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}';
-- то же для категорий (название, видимость)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}';

-- ---- migration-008-home-blocks.sql ----
-- Миграция 008: блоки «Хиты», «Новинки», «Акции» на главной.
-- Выполнить ОДИН раз в Neon SQL Editor (повторный запуск безопасен).
-- Если забудете — сайт сам добавит колонку при первом обращении, но лучше выполнить заранее.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "homeFlags" TEXT[] NOT NULL DEFAULT '{}';

-- ---- migration-009-sales.sql ----
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

-- ---- migration-010-groups.sql ----
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

-- ---- migration-011-customer.sql ----
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

-- ---- Стартовые данные ----
-- Каталог работает в режиме «групп Prom» (как на боевом сайте); служебная группа «Без групи» принимает товары до назначения групп из YML
INSERT INTO "SyncState"("key","value") VALUES ('catalog_mode','groups') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "Category"("name","slug","path","isActive","source") VALUES ('Без групи','bez-grupy','Без групи',false,'legacy') ON CONFLICT ("path") DO NOTHING;

-- Номера заказов в новой базе начинаются с F-10100, чтобы не совпасть с уже существующими заказами F-10001…F-1000x из Neon
ALTER SEQUENCE "OrderNumberSeq" RESTART WITH 10100;

COMMIT;
