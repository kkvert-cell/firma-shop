// Подсказки в строке поиска: несколько товаров и категорий, подходящих под введённый текст.
// Правила те же, что у страницы поиска: каждое слово должно встретиться в названии, артикуле или коде товара.

import type { Run } from "./catalog";

export type SuggestProduct = { name: string; slug: string; price: number; oldPrice: number | null; isAvailable: boolean; image: string | null };
export type SuggestCategory = { name: string; slug: string; path: string };
export type Suggestions = { products: SuggestProduct[]; categories: SuggestCategory[]; total: number };

export const EMPTY_SUGGESTIONS: Suggestions = { products: [], categories: [], total: 0 };

const like = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export function suggestTokens(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 30));
}

export async function suggest(run: Run, q: string, limit = 6): Promise<Suggestions> {
  const tokens = suggestTokens(q);
  if (tokens.join("").length < 2) return EMPTY_SUGGESTIONS;

  const params: unknown[] = tokens.map((t) => `%${like(t)}%`);
  params.push(`${like(tokens[0])}%`); // «начинается с» — такие подсказки идут первыми
  const startN = params.length;

  const prodWhere = tokens.map((_, i) => `(p.name ILIKE $${i + 1} OR p."vendorCode" ILIKE $${i + 1} OR p.sku ILIKE $${i + 1})`).join(" AND ");
  const catWhere = tokens.map((_, i) => `c.name ILIKE $${i + 1}`).join(" AND ");

  const [prods, cats] = await Promise.all([
    run(
      `SELECT p.name, p.slug, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice", p."isAvailable",
              (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image,
              count(*) OVER ()::int AS total
       FROM "Product" p
       WHERE p."isHidden" = false AND ${prodWhere}
       ORDER BY (p.name ILIKE $${startN} OR COALESCE(p."vendorCode" ILIKE $${startN}, false)) DESC, p."isAvailable" DESC, p.name ASC
       LIMIT ${limit}`,
      params
    ),
    run(
      `SELECT c.name, c.slug, c.path
       FROM "Category" c
       WHERE c."isActive" = true AND c.path IS NOT NULL AND ${catWhere}
         AND EXISTS (SELECT 1 FROM "Category" d JOIN "Product" p ON p."categoryId" = d.id
                     WHERE (d.path = c.path OR left(d.path, length(c.path) + 3) = c.path || ' > ') AND p."isHidden" = false)
       ORDER BY (c.name ILIKE $${startN}) DESC, length(c.path) ASC, c.name ASC
       LIMIT 3`,
      params
    ),
  ]);

  return {
    products: prods.map((r) => ({
      name: String(r.name),
      slug: String(r.slug),
      price: Number(r.price),
      oldPrice: r.oldPrice == null ? null : Number(r.oldPrice),
      isAvailable: Boolean(r.isAvailable),
      image: r.image ? String(r.image) : null,
    })),
    categories: cats.map((r) => ({ name: String(r.name), slug: String(r.slug), path: String(r.path) })),
    total: Number(prods[0]?.total ?? 0),
  };
}
