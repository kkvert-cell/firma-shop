-- Миграция 007: редактирование каталога в админке.
-- Выполнить ОДИН раз в Neon SQL Editor (повторный запуск безопасен).
-- Если забудете — сайт сам добавит эти колонки при первом обращении, но лучше выполнить заранее.

-- скрыть товар на сайте (без удаления)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
-- какие поля товара изменены вручную и не должны перезаписываться автообновлением из Prom
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}';
-- то же для категорий (название, видимость)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}';
