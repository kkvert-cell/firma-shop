// Чтение каталога из базы: категории, товары, фильтры, поиск.
// Все функции принимают "запускальник" запросов (run), а не работают с базой
// напрямую — так их можно проверять на любой Postgres, не только на Neon.

import { cache } from "react";
import { healRun } from "./schema-heal";
import { OLD_PRICE_SQL, SALE_ACTIVE, SALE_UNTIL_SQL } from "./sales";
import { getSql } from "./db";
import { findNode, flattenTree, getCatalogTree } from "./catalog-tree";

export type Row = Record<string, unknown>;
export type Run = (query: string, params?: unknown[]) => Promise<Row[]>;

export const getRunner = (): Run => healRun(getSql() as unknown as Run);

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
export type SubCategory = { id: string; name: string; slug: string; n: number; image?: string | null };

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null; // показується лише поки діє акція
  saleUntil: string | null; // дата кінця акції ДД.ММ.РРРР, лише поки акція діє
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
// Товары «в наличии» всегда идут первыми, при любой сортировке и любых фильтрах; «нет в наличии» — в конце списка
const SORT_SQL: Record<SortKey, string> = {
  default: `p."isAvailable" DESC, p.name ASC, p.id ASC`,
  price_asc: `p."isAvailable" DESC, p.price ASC, p.id ASC`,
  price_desc: `p."isAvailable" DESC, p.price DESC, p.id ASC`,
  name: `p."isAvailable" DESC, p.name ASC, p.id ASC`,
};

export type Filters = {
  inStock: boolean;
  priceMin: number | null; // цена «от», грн
  priceMax: number | null; // цена «до», грн
  brandIds: string[];
  categoryIds: string[]; // id головних груп (лише на сторінках підбірок: акції, хіти, новинки)
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

// «1 250,50» / «1250.5» -> 1250.5; всё лишнее и некорректное — игнорируем
function parsePriceParam(v: string | undefined): number | null {
  const t = (v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 9_999_999 ? Math.round(n * 100) / 100 : null;
}

export function parseListParams(sp: SP): ListParams {
  const sortRaw = first(sp.sort) ?? "default";
  const sort = (sortRaw in SORT_SQL ? sortRaw : "default") as SortKey;
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(first(sp.page) ?? "1", 10) || 1));
  const attrs: Record<string, string[]> = {};
  for (const pair of arr(sp.f)) {
    const [a, v] = pair.split(":");
    if (a && v && isId(a) && isId(v)) (attrs[a] ??= []).push(v);
  }
  let priceMin = parsePriceParam(first(sp.pmin));
  let priceMax = parsePriceParam(first(sp.pmax));
  if (priceMin === 0) priceMin = null; // «от 0» — то же, что без нижней границы
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  return {
    sort,
    page,
    filters: {
      inStock: first(sp.instock) === "1",
      priceMin,
      priceMax,
      brandIds: arr(sp.brand).filter(isId),
      categoryIds: arr(sp.cat).filter(isId),
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
  const node = findNode(await getCatalogTree(run), parentId);
  return (node?.children ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, n: c.n, image: c.image }));
}

// Скільки товарів у групі (з підгрупами) зараз у наявності — те саме число, що на картках і в меню
export async function getInStockCount(run: Run, categoryId: string): Promise<number> {
  const node = findNode(await getCatalogTree(run), categoryId);
  return node?.n ?? 0;
}

// Головні групи з підгрупами першого рівня (порожні групи не показуються)
export async function getTopCategoriesWithChildren(run: Run) {
  const tree = await getCatalogTree(run);
  return tree.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    n: t.n,
    image: t.image,
    children: t.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, n: c.n })),
  }));
}

// ---------- Список товаров (категория или поиск) ----------

export type Scope = { type: "category"; categoryId: string } | { type: "search"; tokens: string[] } | { type: "collection"; kind: CollectionKind };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function baseWhere(scope: Scope, params: unknown[]): { cte: string; where: string[]; join: string } {
  if (scope.type === "collection") {
    // Підбірка (акції, хіти, новинки): ті самі умови, що й на головній
    const c = COLLECTIONS[scope.kind];
    return { cte: "", join: c.from, where: [c.anyStock ? SHOWABLE_ANY_STOCK : SHOWABLE, c.where] };
  }
  if (scope.type === "category") {
    params.push(scope.categoryId);
    const n = params.length;
    return {
      cte: `WITH RECURSIVE tree AS (
              SELECT id FROM "Category" WHERE id = $${n}
              UNION ALL
              SELECT c.id FROM "Category" c JOIN tree t ON c."parentId" = t.id WHERE c."isActive" = true)`,
      join: "",
      where: [`p."categoryId" IN (SELECT id FROM tree)`, `p."isHidden" = false`],
    };
  }
  const where = [`p."isHidden" = false`, ...scope.tokens.map((t) => {
    params.push(`%${escapeLike(t)}%`);
    const n = params.length;
    return `(p.name ILIKE $${n} OR p."vendorCode" ILIKE $${n} OR p.sku ILIKE $${n})`;
  })];
  return { cte: "", where, join: "" };
}

function applyFilters(f: Filters, where: string[], params: unknown[]) {
  if (f.inStock) where.push(`p."isAvailable" = true`);
  if (f.priceMin !== null) {
    params.push(f.priceMin);
    where.push(`p.price >= $${params.length}`);
  }
  if (f.priceMax !== null) {
    params.push(f.priceMax);
    where.push(`p.price <= $${params.length}`);
  }
  if (f.brandIds.length) {
    params.push(f.brandIds);
    where.push(`p."brandId" = ANY($${params.length}::text[])`);
  }
  if (f.categoryIds.length) {
    // головна група разом з усіма її підгрупами
    params.push(f.categoryIds);
    where.push(
      `p."categoryId" IN (SELECT c2.id FROM "Category" c2 JOIN "Category" t ON t.id = ANY($${params.length}::text[]) AND (c2.path = t.path OR c2.path LIKE t.path || ' > %'))`
    );
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
  const { cte, where, join } = baseWhere(scope, params);
  applyFilters(lp.filters, where, params);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // У підбірці порядок за замовчуванням свій (в акціях: найбільша знижка зверху)
  const orderSql = scope.type === "collection" && lp.sort === "default" ? (COLLECTIONS[scope.kind].pageOrder ?? COLLECTIONS[scope.kind].order) : SORT_SQL[lp.sort];
  const listParams = [...params, PER_PAGE, (lp.page - 1) * PER_PAGE];
  const limitN = params.length + 1;
  const offsetN = params.length + 2;

  const [countRows, rows] = await Promise.all([
    run(`${cte} SELECT count(*)::int AS n FROM "Product" p ${join} ${whereSql}`, params),
    run(
      `${cte}
       SELECT p.id, p.name, p.slug, p.price::float8 AS price, ${OLD_PRICE_SQL}, ${SALE_UNTIL_SQL},
              p."isAvailable", p."vendorCode",
              (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image
       FROM "Product" p ${join} ${whereSql}
       ORDER BY ${orderSql}
       LIMIT $${limitN} OFFSET $${offsetN}`,
      listParams
    ),
  ]);
  return { items: rows as ProductCardData[], total: Number(countRows[0]?.n ?? 0) };
}

// ---------- Фильтры (по характеристикам и брендам) ----------

export type FacetBrand = { id: string; name: string; n: number };
export type FacetAttr = { id: string; name: string; unit: string | null; total: number; values: { id: string; value: string; n: number }[] };

export type FacetPrice = { min: number | null; max: number | null };

export type FacetGroup = { id: string; name: string; n: number };

export async function getFacets(run: Run, scopeOrCategoryId: string | Scope): Promise<{ brands: FacetBrand[]; attributes: FacetAttr[]; price: FacetPrice; groups: FacetGroup[] }> {
  const params: unknown[] = [];
  const scope: Scope = typeof scopeOrCategoryId === "string" ? { type: "category", categoryId: scopeOrCategoryId } : scopeOrCategoryId;
  const { cte, where, join } = baseWhere(scope, params);
  // Фільтри будуємо лише з товарів у наявності: так у списку немає значень від товарів, яких покупець усе одно не купить
  where.push(`p."isAvailable" = true`);
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [brandRows, attrRows, totalRows, priceRows, groupRows] = await Promise.all([
    run(
      `${cte} SELECT b.id, b.name, count(*)::int AS n
       FROM "Product" p ${join} JOIN "Brand" b ON b.id = p."brandId" ${whereSql}
       GROUP BY b.id, b.name ORDER BY n DESC, b.name LIMIT 12`,
      params
    ),
    run(
      `${cte} SELECT a.id AS "attrId", a.name AS "attrName", a.unit, av.id AS "valueId", av.value, count(*)::int AS n
       FROM "ProductAttributeValue" pav
       JOIN "Product" p ON p.id = pav."productId" ${join}
       JOIN "Attribute" a ON a.id = pav."attributeId"
       JOIN "AttributeValue" av ON av.id = pav."valueId"
       ${whereSql}
       GROUP BY a.id, a.name, a.unit, av.id, av.value`,
      params
    ),
    run(`${cte} SELECT count(*)::int AS n FROM "Product" p ${join} ${whereSql}`, params),
    run(`${cte} SELECT (min(p.price) FILTER (WHERE p.price > 0))::float8 AS min, max(p.price)::float8 AS max FROM "Product" p ${join} ${whereSql}`, params),
    // Головні групи (лише для підбірок): скільки товарів підбірки в кожній
    scope.type === "collection"
      ? run(
          `SELECT t.id, t.name, count(*)::int AS n
           FROM "Product" p ${join}
           JOIN "Category" c ON c.id = p."categoryId"
           JOIN "Category" t ON t."parentId" IS NULL AND t.path = split_part(c.path, ' > ', 1)
           ${whereSql}
           GROUP BY t.id, t.name ORDER BY n DESC, t.name`,
          params
        )
      : Promise.resolve([]),
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
  // Рідкісні значення (1 товар) у великих списках — це здебільшого сміття з карток Prom («Побутової», «Гладкий»…): ховаємо їх
  const attributes = [...byAttr.values()]
    .map((a) => {
      const common = a.values.filter((v) => v.n >= 2);
      return common.length >= 2 && a.values.length > 4 ? { ...a, values: common } : a;
    })
    .filter((a) => a.values.length >= 2 && a.values.length <= 30 && a.total >= minCoverage)
    .sort((x, y) => y.total - x.total)
    .slice(0, 4)
    .map((a) => ({ ...a, values: a.values.sort((p, q) => q.n - p.n || p.value.localeCompare(q.value)).slice(0, 10) }));

  const price: FacetPrice = {
    min: priceRows[0]?.min == null ? null : Math.floor(Number(priceRows[0].min)),
    max: priceRows[0]?.max == null || Number(priceRows[0].max) <= 0 ? null : Math.ceil(Number(priceRows[0].max)),
  };
  return { brands: brandRows as FacetBrand[], attributes, price, groups: groupRows as FacetGroup[] };
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
  saleUntil: string | null;
  saleFrom: string | null;
  currency: string;
  isAvailable: boolean;
  stockQty: number;
  stockExact: boolean; // true — остаток точный (пришёл из KeyCRM)
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
    `SELECT p.id, p.name, p.slug, p.description, p.price::float8 AS price, ${OLD_PRICE_SQL}, ${SALE_UNTIL_SQL},
            (CASE WHEN ${SALE_ACTIVE} THEN to_char(p."saleStartsAt" AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YYYY') END) AS "saleFrom",
            p.currency, p."isAvailable", p."stockQty", (p."stockSyncedAt" IS NOT NULL) AS "stockExact",
            p."vendorCode", p.sku, p."sourceUrl", p."seoTitle", p."seoDescription",
            p."categoryId", c.path AS "categoryPath", b.name AS brand
     FROM "Product" p
     JOIN "Category" c ON c.id = p."categoryId"
     LEFT JOIN "Brand" b ON b.id = p."brandId"
     WHERE p.slug = $1 AND p."isHidden" = false LIMIT 1`,
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
      `SELECT p.id, p.name, p.slug, p.price::float8 AS price, ${OLD_PRICE_SQL}, ${SALE_UNTIL_SQL},
              p."isAvailable", p."vendorCode",
              (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image
       FROM "Product" p
       WHERE p."categoryId" = $1 AND p.id <> $2 AND p."isAvailable" = true AND p."isHidden" = false
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
  const [tree, prods] = await Promise.all([
    getCatalogTree(run),
    run(`SELECT slug, "updatedAt" FROM "Product" WHERE "isHidden" = false ORDER BY id`),
  ]);
  return {
    categories: flattenTree(tree).map((c) => c.slug), // порожні групи в карту сайту не потрапляють
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
  if (lp.filters.priceMin !== null) q.set("pmin", String(lp.filters.priceMin));
  if (lp.filters.priceMax !== null) q.set("pmax", String(lp.filters.priceMax));
  for (const b of lp.filters.brandIds) q.append("brand", b);
  for (const c of lp.filters.categoryIds) q.append("cat", c);
  for (const [a, vs] of Object.entries(lp.filters.attrs)) for (const v of vs) q.append("f", `${a}:${v}`);
  if (opts.withPage && lp.page > 1) q.set("page", String(lp.page));
  return q;
}

export function hasActiveFilters(lp: ListParams): boolean {
  return lp.filters.inStock || lp.filters.priceMin !== null || lp.filters.priceMax !== null || lp.filters.brandIds.length > 0 || lp.filters.categoryIds.length > 0 || Object.keys(lp.filters.attrs).length > 0;
}


// ---------- Подборки для главной: акции, хиты, новинки ----------

export type CollectionKind = "sale" | "new" | "hits";
export const COLLECTION_KINDS: CollectionKind[] = ["sale", "hits", "new"];
export const COLLECTION_TITLES: Record<CollectionKind, string> = { sale: "Акції", new: "Новинки", hits: "Хіти продажів" };
export const COLLECTION_DESCRIPTIONS: Record<CollectionKind, string> = {
  sale: "Товари зі знижкою: стара й нова ціна поруч, строк дії акції вказано біля кожного товару.",
  new: "Нові надходження в каталог.",
  hits: "Найпопулярніші товари нашого магазину.",
};

const SALES_JOIN = `LEFT JOIN (
    SELECT i."productId" AS pid, sum(i.quantity)::int AS q FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o."createdAt" > now() - interval '90 days' AND o.status::text <> 'CANCELLED' GROUP BY i."productId") s ON s.pid = p.id`;

// «Новинка» — добавленный в каталог за последние NEW_DAYS дней (первая массовая загрузка новинками не считается) или отмеченный вручную.
// Очки (солнцезащитные, blue blocker и любые другие) в «Новинки» не попадают вообще, даже с ручной отметкой.
const NEW_DAYS = 30;
const NOT_GLASSES = `p.name !~* '\\m(окуляр|очк[иіа]|очков|очків|glasses|blue[ -]?block)'`;

// anyStock: на странице подборки показывать и товары, которых сейчас нет в наличии (в конце списка); pageOrder: порядок на странице подборки
const COLLECTIONS: Record<CollectionKind, { from: string; where: string; order: string; anyStock?: boolean; pageOrder?: string }> = {
  sale: {
    from: "",
    // Лише акції, що діють зараз (є стара ціна й не минув строк). Ручна відмітка «Акція» без діючої знижки більше нічого не показує.
    where: SALE_ACTIVE,
    order: `(p."oldPrice" - p.price) / p."oldPrice" DESC, p.name ASC, p.id ASC`,
  },
  hits: {
    from: SALES_JOIN,
    where: `('hit' = ANY(p."homeFlags") OR s.pid IS NOT NULL)`,
    order: `('hit' = ANY(p."homeFlags")) DESC, s.q DESC NULLS LAST, p."updatedAt" DESC, p.id ASC`,
  },
  new: {
    from: "",
    where: `(${NOT_GLASSES}) AND ('new' = ANY(p."homeFlags") OR (p."createdAt" > now() - interval '${NEW_DAYS} days' AND p."createdAt" > (SELECT min("createdAt") FROM "Product") + interval '1 day'))`,
    order: `('new' = ANY(p."homeFlags")) DESC, p."createdAt" DESC, p.id ASC`,
    // Новинка остаётся в подборке весь месяц, даже если остаток в KeyCRM временно нулевой: на странице такие товары идут в конце списка
    anyStock: true,
    pageOrder: `p."isAvailable" DESC, ('new' = ANY(p."homeFlags")) DESC, p."createdAt" DESC, p.id ASC`,
  },
};

const SHOWABLE = `p."isHidden" = false AND p."isAvailable" = true AND p.price > 0`;
const SHOWABLE_ANY_STOCK = `p."isHidden" = false AND p.price > 0`;
const CARD_COLS = `p.id, p.name, p.slug, p.price::float8 AS price, ${OLD_PRICE_SQL}, ${SALE_UNTIL_SQL}, p."isAvailable", p."vendorCode",
       (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image`;

export async function listCollection(run: Run, kind: CollectionKind, page: number, perPage = PER_PAGE): Promise<{ items: ProductCardData[]; total: number }> {
  const c = COLLECTIONS[kind];
  const showable = c.anyStock ? SHOWABLE_ANY_STOCK : SHOWABLE;
  const [count, rows] = await Promise.all([
    run(`SELECT count(*)::int AS n FROM "Product" p ${c.from} WHERE ${showable} AND ${c.where}`),
    run(
      `SELECT ${CARD_COLS} FROM "Product" p ${c.from} WHERE ${showable} AND ${c.where} ORDER BY ${c.pageOrder ?? c.order} LIMIT ${perPage} OFFSET ${(Math.max(1, page) - 1) * perPage}`
    ),
  ]);
  return { items: rows as ProductCardData[], total: Number(count[0]?.n ?? 0) };
}

// Для главной: по несколько товаров с фото в каждом блоке (пустые блоки на главной не показываются)
export async function getHomeCollections(run: Run, limit = 10): Promise<Record<CollectionKind, ProductCardData[]>> {
  const hasPhoto = `EXISTS (SELECT 1 FROM "ProductImage" im WHERE im."productId" = p.id)`;
  const results = await Promise.all(
    COLLECTION_KINDS.map((k) =>
      run(`SELECT ${CARD_COLS} FROM "Product" p ${COLLECTIONS[k].from} WHERE ${SHOWABLE} AND ${hasPhoto} AND ${COLLECTIONS[k].where} ORDER BY ${COLLECTIONS[k].order} LIMIT ${limit}`)
    )
  );
  return { sale: results[0] as ProductCardData[], hits: results[1] as ProductCardData[], new: results[2] as ProductCardData[] };
}
