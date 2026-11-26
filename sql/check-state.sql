-- ОТЧЁТ О СОСТОЯНИИ БАЗЫ (только чтение, данные не меняются).
-- Выполнить в Supabase → SQL Editor восстановленного проекта и прислать мне результат целиком (там нет паролей и личных данных).
SELECT
  (SELECT count(*) FROM "Product")                                                              AS "товаров",
  (SELECT count(*) FROM "Category")                                                             AS "категорий",
  (SELECT count(*) FROM "Product" WHERE "oldPrice" > price)                                     AS "со скидкой",
  (SELECT count(*) FROM "Product" WHERE "oldPrice" > price AND "saleEndsAt" IS NULL)            AS "скидка БЕЗ даты окончания",
  (SELECT count(*) FROM "Product" WHERE "saleEndsAt" IS NOT NULL AND "saleEndsAt" <= now())     AS "акций, срок которых уже истёк",
  (SELECT count(*) FROM "Product" WHERE "saleEndsAt" > now())                                   AS "акций с датой в будущем",
  (SELECT min("saleEndsAt")::text FROM "Product" WHERE "saleEndsAt" > now())                    AS "ближайшее окончание акции",
  (SELECT count(*) FROM "Product" WHERE 'sale' = ANY("homeFlags"))                              AS "флаг sale",
  (SELECT count(*) FROM "Product" WHERE 'new' = ANY("homeFlags"))                               AS "флаг new",
  (SELECT count(*) FROM "Product" WHERE 'hit' = ANY("homeFlags"))                               AS "флаг hit",
  (SELECT count(*) FROM "Product" WHERE cardinality("lockedFields") > 0)                        AS "товаров с закреплёнными полями",
  (SELECT count(*) FROM "ProductImage")                                                         AS "записей изображений",
  (SELECT count(*) FROM "PriceLog")                                                             AS "записей истории цен",
  (SELECT count(*) FROM "Order")                                                                AS "заказов",
  (SELECT max("orderNumber") FROM "Order")                                                      AS "последний номер заказа",
  (SELECT last_value FROM "OrderNumberSeq")                                                     AS "счётчик номеров заказов",
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')                                  AS "таблиц",
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity) AS "таблиц с включённой защитой RLS",
  (SELECT value FROM "SyncState" WHERE key = 'catalog_mode')                                    AS "режим каталога",
  (SELECT count(*) FROM "SyncState" WHERE key LIKE 'lock:%')                                   AS "зависших замков";
