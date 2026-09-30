// Запись товаров из фида Прома в нашу базу (Neon). Все операции идемпотентны:
// повторный запуск обновляет существующие записи, а не создаёт дубли.
// Данные уходят в базу пачками через JSON, чтобы укладываться в лимит
// запросов Cloudflare Workers на один вызов.

import { FeedItem, slugify } from "./prom-feed";

export type SqlRunner = (query: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const j = (v: unknown) => JSON.stringify(v);

export async function importItems(sql: SqlRunner, items: FeedItem[], runTs: string) {
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
  const maxDepth = Math.max(0, ...[...cats.values()].map((c) => c.depth));
  for (let d = 1; d <= maxDepth; d++) {
    const rows = [...cats.values()].filter((c) => c.depth === d);
    await sql(
      `INSERT INTO "Category"("name","slug","path","parentId","isActive")
       SELECT x.name, x.slug, x.path, (SELECT c.id FROM "Category" c WHERE c.path = x."parentPath"), true
       FROM jsonb_to_recordset($1::jsonb) AS x(name text, slug text, path text, "parentPath" text)
       ON CONFLICT (path) DO UPDATE SET "name" = EXCLUDED."name", "isActive" = true`,
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
      currency: it.currency,
      available: it.available,
      sourceUrl: it.sourceUrl,
    });
  }
  await sql(
    `INSERT INTO "Product"("sku","externalId","vendorCode","slug","name","description","categoryId","brandId","price","currency","isAvailable","sourceUrl","syncedAt","updatedAt")
     SELECT 'prom-' || x."externalId", x."externalId", x."vendorCode", x.slug, x.name, x.description,
            (SELECT c.id FROM "Category" c WHERE c.path = x."categoryPath"),
            (SELECT b.id FROM "Brand" b WHERE b.slug = x."brandSlug"),
            COALESCE(x.price, 0), x.currency, x.available, x."sourceUrl", $2::timestamp, now()
     FROM jsonb_to_recordset($1::jsonb) AS x("externalId" text, "vendorCode" text, slug text, name text, description text,
          "categoryPath" text, "brandSlug" text, price numeric, currency text, available boolean, "sourceUrl" text)
     ON CONFLICT ("externalId") DO UPDATE SET
       slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description,
       "vendorCode" = EXCLUDED."vendorCode",
       "categoryId" = EXCLUDED."categoryId", "brandId" = EXCLUDED."brandId", price = EXCLUDED.price,
       currency = EXCLUDED.currency, "isAvailable" = EXCLUDED."isAvailable", "sourceUrl" = EXCLUDED."sourceUrl",
       "syncedAt" = EXCLUDED."syncedAt", "updatedAt" = now()`,
    [j([...products.values()]), runTs]
  );

  // 4. Фото: заменяем целиком набор фото каждого товара
  const ids = items.map((i) => i.externalId);
  const imageRows = items.flatMap((it) => it.images.map((url, ord) => ({ externalId: it.externalId, url, ord })));
  await sql(
    `DELETE FROM "ProductImage" WHERE "productId" IN (SELECT id FROM "Product" WHERE "externalId" = ANY($1::text[]))`,
    [ids]
  );
  if (imageRows.length) {
    await sql(
      `INSERT INTO "ProductImage"("productId","url","sortOrder")
       SELECT p.id, i.url, i.ord FROM jsonb_to_recordset($1::jsonb) AS i("externalId" text, url text, ord int)
       JOIN "Product" p ON p."externalId" = i."externalId"`,
      [j(imageRows)]
    );
  }

  // 5. Значения характеристик у товаров
  if (perProduct.length) {
    await sql(
      `INSERT INTO "ProductAttributeValue"("productId","attributeId","valueId")
       SELECT p.id, a.id, av.id FROM jsonb_to_recordset($1::jsonb) AS d("externalId" text, "attrSlug" text, value text)
       JOIN "Product" p ON p."externalId" = d."externalId"
       JOIN "Attribute" a ON a.slug = d."attrSlug"
       JOIN "AttributeValue" av ON av."attributeId" = a.id AND av.value = d.value
       ON CONFLICT ("productId","attributeId") DO UPDATE SET "valueId" = EXCLUDED."valueId"`,
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
