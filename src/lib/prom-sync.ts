// Запись товаров из фида Прома в нашу базу (Neon). Все операции идемпотентны:
// повторный запуск обновляет существующие записи, а не создаёт дубли.
// Данные уходят в базу пачками через JSON, чтобы укладываться в лимит
// запросов Cloudflare Workers на один вызов.

import { FeedItem, slugify } from "./prom-feed";

export type SqlRunner = (query: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const j = (v: unknown) => JSON.stringify(v);

// groupsMode: каталог переключён на группы продавца — категории маркетплейса не создаём и не трогаем,
// новым товарам ставим служебную группу «Без групи», а настоящую группу им назначает синхронизация YML (prom-groups).
export async function importItems(sql: SqlRunner, items: FeedItem[], runTs: string, groupsMode = false) {
  // 1. Категории: каждый уровень пути ("A", "A > B", "A > B > C") — отдельная запись
  const cats = new Map<string, { name: string; slug: string; path: string; parentPath: string | null; depth: number }>();
  for (const it of items) {
    for (let d = 1; d <= it.categoryPath.length; d++) {
      const parts = it.categoryPath.slice(0, d);
      const path = parts.join(" > ");
      if (!cats.has(path)) {
        cats.set(path, {
          name: parts[d - 1],
          slug: slugify(parts.join(" ")),
          path,
          parentPath: d > 1 ? parts.slice(0, d - 1).join(" > ") : null,
          depth: d,
        });
      }
    }
  }
  const maxDepth = groupsMode ? 0 : Math.max(0, ...[...cats.values()].map((c) => c.depth));
  for (let d = 1; d <= maxDepth; d++) {
    const rows = [...cats.values()].filter((c) => c.depth === d);
    await sql(
      `INSERT INTO "Category"("name","slug","path","parentId","isActive")
       SELECT x.name, x.slug, x.path, (SELECT c.id FROM "Category" c WHERE c.path = x."parentPath"), true
       FROM jsonb_to_recordset($1::jsonb) AS x(name text, slug text, path text, "parentPath" text)
       ON CONFLICT (path) DO UPDATE SET
         "name" = CASE WHEN 'name' = ANY("Category"."lockedFields") THEN "Category"."name" ELSE EXCLUDED."name" END,
         "isActive" = CASE WHEN 'visibility' = ANY("Category"."lockedFields") THEN "Category"."isActive" ELSE true END
       WHERE (NOT ('name' = ANY("Category"."lockedFields")) AND "Category"."name" IS DISTINCT FROM EXCLUDED."name")
          OR (NOT ('visibility' = ANY("Category"."lockedFields")) AND "Category"."isActive" IS DISTINCT FROM true)`,
      [j(rows)]
    );
  }

  // 2. Бренды
  const brands = new Map<string, { name: string; slug: string }>();
  for (const it of items) if (it.brand) brands.set(slugify(it.brand), { name: it.brand, slug: slugify(it.brand) });
  if (brands.size) {
    await sql(
      `INSERT INTO "Brand"("name","slug")
       SELECT x.name, x.slug FROM jsonb_to_recordset($1::jsonb) AS x(name text, slug text)
       ON CONFLICT DO NOTHING`,
      [j([...brands.values()])]
    );
  }

  // 3. Характеристики (EAV): сами характеристики и их значения
  const attrs = new Map<string, { name: string; slug: string }>();
  const attrValues = new Map<string, { attrSlug: string; value: string }>();
  const perProduct: { externalId: string; attrSlug: string; value: string }[] = [];
  for (const it of items) {
    const seen = new Map<string, string>();
    for (const dt of it.details) {
      const attrSlug = slugify(dt.name);
      if (!attrSlug) continue;
      attrs.set(attrSlug, { name: dt.name, slug: attrSlug });
      attrValues.set(`${attrSlug}|${dt.value}`, { attrSlug, value: dt.value });
      seen.set(attrSlug, dt.value); // один товар — одно значение характеристики
    }
    for (const [attrSlug, value] of seen) perProduct.push({ externalId: it.externalId, attrSlug, value });
  }
  if (attrs.size) {
    await sql(
      `INSERT INTO "Attribute"("name","slug","type")
       SELECT x.name, x.slug, 'SELECT'::"AttributeType" FROM jsonb_to_recordset($1::jsonb) AS x(name text, slug text)
       ON CONFLICT DO NOTHING`,
      [j([...attrs.values()])]
    );
    await sql(
      `INSERT INTO "AttributeValue"("attributeId","value")
       SELECT a.id, x.value FROM jsonb_to_recordset($1::jsonb) AS x("attrSlug" text, value text)
       JOIN "Attribute" a ON a.slug = x."attrSlug"
       ON CONFLICT DO NOTHING`,
      [j([...attrValues.values()])]
    );
  }

  // 3. Товары
  const products = new Map<string, unknown>();
  for (const it of items) {
    products.set(it.externalId, {
      externalId: it.externalId,
      slug: it.slug,
      name: it.name,
      description: it.description,
      categoryPath: it.categoryPath.join(" > "),
      brandSlug: it.brand ? slugify(it.brand) : null,
      vendorCode: it.vendorCode,
      price: it.price,
      oldPrice: it.oldPrice,
      currency: it.currency,
      available: it.available,
      sourceUrl: it.sourceUrl,
    });
  }
  await sql(
    `INSERT INTO "Product"("sku","externalId","vendorCode","slug","name","description","categoryId","brandId","price","oldPrice","currency","isAvailable","sourceUrl","syncedAt","updatedAt")
     SELECT 'prom-' || x."externalId", x."externalId", x."vendorCode", x.slug, x.name, x.description,
            COALESCE((SELECT c.id FROM "Category" c WHERE c.path = x."categoryPath" AND c.source = 'legacy'), (SELECT c.id FROM "Category" c WHERE c.path = 'Без групи')),
            (SELECT b.id FROM "Brand" b WHERE b.slug = x."brandSlug"),
            COALESCE(x.price, 0), x."oldPrice", x.currency, x.available, x."sourceUrl", $2::timestamp, now()
     FROM jsonb_to_recordset($1::jsonb) AS x("externalId" text, "vendorCode" text, slug text, name text, description text,
          "categoryPath" text, "brandSlug" text, price numeric, "oldPrice" numeric, currency text, available boolean, "sourceUrl" text)
     ON CONFLICT ("externalId") DO UPDATE SET
       slug = EXCLUDED.slug,
       name = CASE WHEN 'name' = ANY("Product"."lockedFields") THEN "Product".name ELSE EXCLUDED.name END,
       description = CASE WHEN 'description' = ANY("Product"."lockedFields") THEN "Product".description ELSE EXCLUDED.description END,
       "vendorCode" = COALESCE("Product"."vendorCode", EXCLUDED."vendorCode"),
       "categoryId" = CASE WHEN $3::boolean OR 'category' = ANY("Product"."lockedFields") THEN "Product"."categoryId" ELSE EXCLUDED."categoryId" END,
       "brandId" = CASE WHEN 'brand' = ANY("Product"."lockedFields") THEN "Product"."brandId" ELSE EXCLUDED."brandId" END,
       price = CASE WHEN 'price' = ANY("Product"."lockedFields") THEN "Product".price ELSE EXCLUDED.price END,
       "oldPrice" = CASE WHEN 'price' = ANY("Product"."lockedFields") THEN "Product"."oldPrice" ELSE EXCLUDED."oldPrice" END,
       currency = EXCLUDED.currency,
       "isAvailable" = CASE WHEN "Product"."stockSyncedAt" IS NOT NULL THEN "Product"."isAvailable" ELSE EXCLUDED."isAvailable" END,
       "sourceUrl" = EXCLUDED."sourceUrl",
       "syncedAt" = EXCLUDED."syncedAt", "updatedAt" = now()
     WHERE "Product".slug IS DISTINCT FROM EXCLUDED.slug
        OR (NOT ('name' = ANY("Product"."lockedFields")) AND "Product".name IS DISTINCT FROM EXCLUDED.name)
        OR (NOT ('description' = ANY("Product"."lockedFields")) AND "Product".description IS DISTINCT FROM EXCLUDED.description)
        OR ("Product"."vendorCode" IS NULL AND EXCLUDED."vendorCode" IS NOT NULL)
        OR (NOT ($3::boolean OR 'category' = ANY("Product"."lockedFields")) AND "Product"."categoryId" IS DISTINCT FROM EXCLUDED."categoryId")
        OR (NOT ('brand' = ANY("Product"."lockedFields")) AND "Product"."brandId" IS DISTINCT FROM EXCLUDED."brandId")
        OR (NOT ('price' = ANY("Product"."lockedFields")) AND ("Product".price IS DISTINCT FROM EXCLUDED.price OR "Product"."oldPrice" IS DISTINCT FROM EXCLUDED."oldPrice"))
        OR "Product".currency IS DISTINCT FROM EXCLUDED.currency
        OR ("Product"."stockSyncedAt" IS NULL AND "Product"."isAvailable" IS DISTINCT FROM EXCLUDED."isAvailable")
        OR "Product"."sourceUrl" IS DISTINCT FROM EXCLUDED."sourceUrl"`,
    [j([...products.values()]), runTs, groupsMode]
  );
  // Товари, які не змінились: лише позначка «побачили у фіді» (потрібна, щоб знаходити зниклі товари), без зміни updatedAt
  await sql(
    `UPDATE "Product" SET "syncedAt" = $2::timestamp WHERE "externalId" = ANY($1::text[]) AND "syncedAt" IS DISTINCT FROM $2::timestamp`,
    [[...products.keys()], runTs]
  );

  // 3а. Акції, які сайт уже завершив за строком: якщо Prom усе ще віддає ту саму знижку — лишаємо звичайну ціну.
  //     Спочатку знімаємо позначку з товарів, у яких знижка зникла з фіда, потім повертаємо звичайну ціну тим, у кого вона лишилась.
  const feedIds = items.map((i) => i.externalId);
  await sql(
    `UPDATE "Product" SET "saleEndedPrice" = NULL
      WHERE "externalId" = ANY($1::text[]) AND "saleEndedPrice" IS NOT NULL AND "oldPrice" IS NULL AND NOT ('price' = ANY("lockedFields"))`,
    [feedIds]
  );
  await sql(
    `UPDATE "Product" SET price = "oldPrice", "oldPrice" = NULL, "updatedAt" = now()
      WHERE "externalId" = ANY($1::text[]) AND NOT ('price' = ANY("lockedFields"))
        AND "saleEndedPrice" IS NOT NULL AND "oldPrice" > price AND price = "saleEndedPrice"`,
    [feedIds]
  );

  // 4. Фото: набор фото товара переписуємо лише там, де він справді змінився (порядок теж враховується)
  const ids = items.map((i) => i.externalId);
  const imageRows = items.flatMap((it) => it.images.map((url, ord) => ({ externalId: it.externalId, url, ord })));
  await sql(
    `WITH fresh AS (
       SELECT p.id AS pid, i.url, i.ord
       FROM jsonb_to_recordset($2::jsonb) AS i("externalId" text, url text, ord int)
       JOIN "Product" p ON p."externalId" = i."externalId"),
     targets AS (
       SELECT p.id FROM "Product" p
       WHERE p."externalId" = ANY($1::text[]) AND NOT ('images' = ANY(p."lockedFields"))),
     changed AS (
       SELECT t.id FROM targets t
       WHERE COALESCE((SELECT array_agg(pi.url ORDER BY pi."sortOrder", pi.id) FROM "ProductImage" pi WHERE pi."productId" = t.id), '{}'::text[])
             IS DISTINCT FROM COALESCE((SELECT array_agg(f.url ORDER BY f.ord) FROM fresh f WHERE f.pid = t.id), '{}'::text[])),
     del AS (DELETE FROM "ProductImage" WHERE "productId" IN (SELECT id FROM changed) RETURNING 1)
     INSERT INTO "ProductImage"("productId", url, "sortOrder")
     SELECT f.pid, f.url, f.ord FROM fresh f WHERE f.pid IN (SELECT id FROM changed)`,
    [ids, j(imageRows)]
  );

  // 5. Значения характеристик у товаров
  if (perProduct.length) {
    await sql(
      `INSERT INTO "ProductAttributeValue"("productId","attributeId","valueId")
       SELECT p.id, a.id, av.id FROM jsonb_to_recordset($1::jsonb) AS d("externalId" text, "attrSlug" text, value text)
       JOIN "Product" p ON p."externalId" = d."externalId"
       JOIN "Attribute" a ON a.slug = d."attrSlug"
       JOIN "AttributeValue" av ON av."attributeId" = a.id AND av.value = d.value
       ON CONFLICT ("productId","attributeId") DO UPDATE SET "valueId" = EXCLUDED."valueId"
         WHERE "ProductAttributeValue"."valueId" IS DISTINCT FROM EXCLUDED."valueId"`,
      [j(perProduct)]
    );
  }

  return { categories: cats.size, brands: brands.size, attributes: attrs.size, products: products.size, images: imageRows.length };
}

// Товары, которых больше нет в фиде (снята метка, удалены на Проме), — помечаем «нет в наличии».
export async function markMissing(sql: SqlRunner, runTs: string): Promise<number> {
  const rows = await sql(
    `WITH u AS (UPDATE "Product" SET "isAvailable" = false
                WHERE "externalId" IS NOT NULL AND ("syncedAt" IS NULL OR "syncedAt" < $1::timestamp)
                RETURNING 1)
     SELECT count(*)::int AS n FROM u`,
    [runTs]
  );
  return Number(rows[0]?.n ?? 0);
}
