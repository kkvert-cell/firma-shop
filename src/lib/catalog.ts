// Чтение каталога из базы: категории, товары, фильтры, поиск.
// Все функции принимают "запускальник" запросов (run), а не работают с базой
// напрямую — так их можно проверять на любой Postgres, не только на Neon.

import { cache } from "react";
import { getSql } from "./db";

export type Row = Record<string, unknown>;
export type Run = (query: string, params?: unknown[]) => Promise<Row[]>;

export const getRunner = (): Run => getSql() as unknown as Run;

// ---------- Типы ----------

export type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  path: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};
export type Crumb = { name: string; slug: string };
export type SubCategory = { id: string; name: string; slug: string; n: number };

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  isAvailable: boolean;
  vendorCode: string | null;
  image: string | null;
};

export type SortKey = "default" | "price_asc" | "price_desc" | "name";
export const SORT_LABELS: Record<SortKey, string> = {
  default: "За замовчуванням",
  price_asc: "Від дешевших",
  price_desc: "Від дорожчих",
  name: "За назвою",
};
const SORT_SQL: Record<SortKey, string> = {
  default: `p."isAvailable" DESC, p.name ASC, p.id ASC`,
  price_asc: `p.price ASC, p.id ASC`,
  price_desc: `p.price DESC, p.id ASC`,
  name: `p.name ASC, p.id ASC`,
};

export type Filters = {
  inStock: boolean;
  brandIds: string[];
  attrs: Record<string, string[]>; // id характеристики -> выбранные id значений
};

export type ListParams = {
  filters: Filters;
  sort: SortKey;
  page: number;
};

export const PER_PAGE = 24;
const MAX_PAGE = 500;

// ---------- Разбор адресной строки ----------

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const first = (v: string | string[] | undefined): string | undefined => arr(v)[0];
const isId = (s: string) => /^[0-9a-zA-Z-]{6,64}$/.test(s);

export function parseListParams(sp: SP): ListParams {
  const sortRaw = first(sp.sort) ?? "default";
  const sort = (sortRaw in SORT_SQL ? sortRaw : "default") as SortKey;
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(first(sp.page) ?? "1", 10) || 1));
  const attrs: Record<string, string[]> = {};
  for (const pair of arr(sp.f)) {
    const [a, v] = pair.split(":");
    if (a && v && isId(a) && isId(v)) (attrs[a] ??= []).push(v);
  }
  return {
    sort,
    page,
    filters: {
      inStock: first(sp.instock) === "1",
      brandIds: arr(sp.brand).filter(isId),
      attrs,
    },
  };
}

// ---------- Категории ----------

export async function getCategoryBySlug(run: Run, slug: string): Promise<CategoryInfo | null> {
  const rows = await run(
    `SELECT id, name, slug, path, description, "seoTitle", "seoDescription"
     FROM "Category" WHERE slug = $1 AND "isActive" = true
     ORDER BY path NULLS LAST LIMIT 1`,
    [slug]
  );
  return (rows[0] as CategoryInfo | undefined) ?? null;
}

export async function getBreadcrumbs(run: Run, path: string): Promise<Crumb[]> {
  const parts = path.split(" > ");
  const prefixes = parts.map((_, i) => parts.slice(0, i + 1).join(" > "));
  const rows = await run(
    `SELECT name, slug, path FROM "Category" WHERE path = ANY($1::text[]) ORDER BY length(path)`,
    [prefixes]
  );
  return rows.map((r) => ({ name: String(r.name), slug: String(r.slug) }));
}

export async function getSubcategories(run: Run, parentId: string): Promise<SubCategory[]> {
  const rows = await run(
    `SELECT c.id, c.name, c.slug, count(p.id)::int AS n
     FROM "Category" c
     LEFT JOIN "Category" d ON d.path = c.path OR left(d.path, length(c.path) + 3) = c.path || ' > '
     LEFT JOIN "Product" p ON p."categoryId" = d.id
     WHERE c."parentId" = $1 AND c."isActive" = true
     GROUP BY c.id, c.name, c.slug, c."sortOrder"
     ORDER BY c."sortOrder", c.name`,
    [parentId]
  );
  return (rows as SubCategory[]).filter((r) => r.n > 0);
}

export async function getTopCategoriesWithChildren(run: Run) {
  const rows = await run(
    `SELECT c.id, c.name, c.slug, c."parentId"
     FROM "Category" c WHERE c."isActive" = true AND c.path IS NOT NULL
       AND (c."parentId" IS NULL OR c."parentId" IN (SELECT id FROM "Category" WHERE "parentId" IS NULL))
     ORDER BY c."sortOrder", c.name`
  );
  const tops = rows.filter((r) => r.parentId === null);
  return tops.map((t) => ({
    id: String(t.id),
    name: String(t.name),
    slug: String(t.slug),
    children: rows
      .filter((r) => r.parentId === t.id)
      .map((r) => ({ id: String(r.id), name: String(r.name), slug: String(r.slug) })),
  }));
}

// ---------- Список товаров (категория или поиск) ----------

export type Scope = { type: "category"; categoryId: string } | { type: "search"; tokens: string[] };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function baseWhere(scope: Scope, params: unknown[]): { cte: string; where: string[] } {
  if (scope.type === "category") {
    params.push(scope.categoryId);
    const n = params.length;
    return {
      cte: `WITH RECURSIVE tree AS (
              SELECT id FROM "Category" WHERE id = $${n}
              UNION ALL
              SELECT c.id FROM "Category" c JOIN tree t ON c."parentId" = t.id)`,
      where: [`p."categoryId" IN (SELECT id FROM tree)`],
    };
  }
  const where = scope.tokens.map((t) => {
    params.push(`%${escapeLike(t)}%`);
    const n = params.length;
    return `(p.name ILIKE $${n} OR p."vendorCode" ILIKE $${n} OR p.sku ILIKE $${n})`;
  });
  return { cte: "", where };
}

function applyFilters(f: Filters, where: string[], params: unknown[]) {
  if (f.inStock) where.push(`p."isAvailable" = true`);
  if (f.brandIds.length) {
    params.push(f.brandIds);
    where.push(`p."brandId" = ANY($${params.length}::text[])`);
  }
  for (const [attrId, valueIds] of Object.entries(f.attrs)) {
    params.push(attrId, valueIds);
    const a = params.length - 1;
    const v = params.length;
    where.push(
      `EXISTS (SELECT 1 FROM "ProductAttributeValue" pav
               WHERE pav."productId" = p.id AND pav."attributeId" = $${a} AND pav."valueId" = ANY($${v}::text[]))`
    );
  }
}

export async function listProducts(
  run: Run,
  scope: Scope,
  lp: ListParams
): Promise<{ items: ProductCardData[]; total: number }> {
  const params: unknown[] = [];
  const { cte, where } = baseWhere(scope, params);
  applyFilters(lp.filters, where, params);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const listParams = [...params, PER_PAGE, (lp.page - 1) * PER_PAGE];
  const limitN = params.length + 1;
  const offsetN = params.length + 2;

  const [countRows, rows] = await Promise.all([
    run(`${cte} SELECT count(*)::int AS n FROM "Product" p ${whereSql}`, params),
    run(
      `${cte}
       SELECT p.id, p.name, p.slug, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice",
              p."isAvailable", p."vendorCode",
              (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image
       FROM "Product" p ${whereSql}
       ORDER BY ${SORT_SQL[lp.sort]}
       LIMIT $${limitN} OFFSET $${offsetN}`,
      listParams
    ),
  ]);
  return { items: rows as ProductCardData[], total: Number(countRows[0]?.n ?? 0) };
}

// ---------- Фильтры (по характеристикам и брендам) ----------

export type FacetBrand = { id: string; name: string; n: number };
export type FacetAttr = { id: string; name: string; unit: string | null; total: number; values: { id: string; value: string; n: number }[] };

export async function getFacets(run: Run, categoryId: string): Promise<{ brands: FacetBrand[]; attributes: FacetAttr[] }> {
  const params: unknown[] = [];
  const { cte, where } = baseWhere({ type: "category", categoryId }, params);
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [brandRows, attrRows, totalRows] = await Promise.all([
    run(
      `${cte} SELECT b.id, b.name, count(*)::int AS n
       FROM "Product" p JOIN "Brand" b ON b.id = p."brandId" ${whereSql}
       GROUP BY b.id, b.name ORDER BY n DESC, b.name LIMIT 12`,
      params
    ),
    run(
      `${cte} SELECT a.id AS "attrId", a.name AS "attrName", a.unit, av.id AS "valueId", av.value, count(*)::int AS n
       FROM "ProductAttributeValue" pav
       JOIN "Product" p ON p.id = pav."productId"
       JOIN "Attribute" a ON a.id = pav."attributeId"
       JOIN "AttributeValue" av ON av.id = pav."valueId"
       ${whereSql}
       GROUP BY a.id, a.name, a.unit, av.id, av.value`,
      params
    ),
    run(`${cte} SELECT count(*)::int AS n FROM "Product" p ${whereSql}`, params),
  ]);

  const totalProducts = Number(totalRows[0]?.n ?? 0);
  const byAttr = new Map<string, FacetAttr>();
  for (const r of attrRows) {
    const id = String(r.attrId);
    let a = byAttr.get(id);
    if (!a) {
      a = { id, name: String(r.attrName), unit: (r.unit as string | null) ?? null, total: 0, values: [] };
      byAttr.set(id, a);
    }
    a.total += Number(r.n);
    a.values.push({ id: String(r.valueId), value: String(r.value), n: Number(r.n) });
  }

  // Полезный фильтр: есть из чего выбирать (2..30 значений) и охватывает заметную часть товаров.
  const minCoverage = Math.max(3, Math.floor(totalProducts * 0.15));
  const attributes = [...byAttr.values()]
    .filter((a) => a.values.length >= 2 && a.values.length <= 30 && a.total >= minCoverage)
    .sort((x, y) => y.total - x.total)
    .slice(0, 4)
    .map((a) => ({ ...a, values: a.values.sort((p, q) => q.n - p.n || p.value.localeCompare(q.value)).slice(0, 10) }));

  return { brands: brandRows as FacetBrand[], attributes };
}

// Подписи для уже выбранных фильтров (чтобы показать плашки-теги, даже если фильтр скрыт из списка).
export async function getFilterLabels(run: Run, f: Filters): Promise<{ brands: Record<string, string>; values: Record<string, { attr: string; value: string }> }> {
  const valueIds = Object.values(f.attrs).flat();
  const [b, v] = await Promise.all([
    f.brandIds.length ? run(`SELECT id, name FROM "Brand" WHERE id = ANY($1::text[])`, [f.brandIds]) : Promise.resolve([]),
    valueIds.length
      ? run(
          `SELECT av.id, av.value, a.name AS attr FROM "AttributeValue" av JOIN "Attribute" a ON a.id = av."attributeId" WHERE av.id = ANY($1::text[])`,
          [valueIds]
        )
      : Promise.resolve([]),
  ]);
  return {
    brands: Object.fromEntries(b.map((r) => [String(r.id), String(r.name)])),
    values: Object.fromEntries(v.map((r) => [String(r.id), { attr: String(r.attr), value: String(r.value) }])),
  };
}

// ---------- Карточка товара ----------

export type ProductFull = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  currency: string;
  isAvailable: boolean;
  vendorCode: string | null;
  sku: string;
  sourceUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  categoryId: string;
  categoryPath: string;
  brand: string | null;
};

export async function getProductBySlug(run: Run, slug: string) {
  const rows = await run(
    `SELECT p.id, p.name, p.slug, p.description, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice",
            p.currency, p."isAvailable", p."vendorCode", p.sku, p."sourceUrl", p."seoTitle", p."seoDescription",
            p."categoryId", c.path AS "categoryPath", b.name AS brand
     FROM "Product" p
     JOIN "Category" c ON c.id = p."categoryId"
     LEFT JOIN "Brand" b ON b.id = p."brandId"
     WHERE p.slug = $1 LIMIT 1`,
    [slug]
  );
  const product = rows[0] as ProductFull | undefined;
  if (!product) return null;

  const [images, attrs, related, crumbs] = await Promise.all([
    run(`SELECT url, "altText" FROM "ProductImage" WHERE "productId" = $1 ORDER BY "sortOrder"`, [product.id]),
    run(
      `SELECT a.name, a.unit, COALESCE(av.value, pav."freeText") AS value
       FROM "ProductAttributeValue" pav
       JOIN "Attribute" a ON a.id = pav."attributeId"
       LEFT JOIN "AttributeValue" av ON av.id = pav."valueId"
       WHERE pav."productId" = $1 ORDER BY a.name`,
      [product.id]
    ),
    run(
      `SELECT p.id, p.name, p.slug, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice",
              p."isAvailable", p."vendorCode",
              (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image
       FROM "Product" p
       WHERE p."categoryId" = $1 AND p.id <> $2 AND p."isAvailable" = true
       ORDER BY random() LIMIT 4`,
      [product.categoryId, product.id]
    ),
    getBreadcrumbs(run, product.categoryPath),
  ]);

  return {
    product,
    images: images as { url: string; altText: string | null }[],
    attrs: attrs as { name: string; unit: string | null; value: string }[],
    related: related as ProductCardData[],
    crumbs,
  };
}

// ---------- Для карты сайта ----------

export async function getSitemapData(run: Run) {
  const [cats, prods] = await Promise.all([
    run(`SELECT slug FROM "Category" WHERE "isActive" = true AND path IS NOT NULL ORDER BY path`),
    run(`SELECT slug, "updatedAt" FROM "Product" ORDER BY id`),
  ]);
  return {
    categories: cats.map((r) => String(r.slug)),
    products: prods.map((r) => ({ slug: String(r.slug), updatedAt: new Date(r.updatedAt as string) })),
  };
}

// ---------- Версии с кэшем на время одного запроса (чтобы не дёргать базу дважды) ----------

export const loadCategory = cache(async (slug: string) => getCategoryBySlug(getRunner(), slug));
export const loadProduct = cache(async (slug: string) => getProductBySlug(getRunner(), slug));

// ---------- Адресная строка из выбранных фильтров ----------

export function toQuery(lp: ListParams, opts: { withPage?: boolean } = {}): URLSearchParams {
  const q = new URLSearchParams();
  if (lp.sort !== "default") q.set("sort", lp.sort);
  if (lp.filters.inStock) q.set("instock", "1");
  for (const b of lp.filters.brandIds) q.append("brand", b);
  for (const [a, vs] of Object.entries(lp.filters.attrs)) for (const v of vs) q.append("f", `${a}:${v}`);
  if (opts.withPage && lp.page > 1) q.set("page", String(lp.page));
  return q;
}

export function hasActiveFilters(lp: ListParams): boolean {
  return lp.filters.inStock || lp.filters.brandIds.length > 0 || Object.keys(lp.filters.attrs).length > 0;
}
