// Общие помощники для редактирования каталога в админке.
import type { Run } from "./catalog";
import { slugify } from "./prom-feed";
import { getCatalogMode } from "./prom-groups";

export const ID_RE = /^[0-9a-zA-Z_-]{6,40}$/;

export type CatRow = { id: string; name: string; path: string; parentId: string | null; isActive: boolean; depth: number; n: number; lockedFields: string[]; nameSource?: string | null; nameAuto?: boolean };

// Список категорій для адмінки відповідає режиму каталогу: «legacy» — категорії маркетплейсу, «groups» — ваші групи Prom
export async function allCategories(run: Run): Promise<CatRow[]> {
  const mode = await getCatalogMode(run);
  const rows = await run(
    `SELECT c.id, c.name, c.path, c."parentId", c."isActive", c."lockedFields", c."nameSource", c."nameAuto",
            (SELECT count(*)::int FROM "Product" p WHERE p."categoryId" = c.id) AS n
     FROM "Category" c WHERE c.path IS NOT NULL AND c.path <> 'Без групи'
       AND (($1 = 'groups' AND c.source = 'group' AND c."inFeed") OR ($1 <> 'groups' AND c.source = 'legacy'))
     ORDER BY c.path`,
    [mode]
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    path: String(r.path),
    parentId: r.parentId ? String(r.parentId) : null,
    isActive: Boolean(r.isActive),
    depth: String(r.path).split(" > ").length - 1,
    n: Number(r.n),
    lockedFields: (r.lockedFields as string[] | null) ?? [],
    nameSource: r.nameSource ? String(r.nameSource) : null,
    nameAuto: Boolean(r.nameAuto),
  }));
}

export const catLabel = (c: Pick<CatRow, "name" | "depth">) => `${"— ".repeat(c.depth)}${c.name}`;

export const text = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
export const oneLine = (v: unknown, max: number) => text(v, max).replace(/\s+/g, " ");

export function parsePrice(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : NaN;
}

// Список адресов фото: по одному в строке, только https, без повторов, не больше 12
export function parseImages(v: unknown): string[] {
  const out: string[] = [];
  for (const line of String(v ?? "").split(/\r?\n/)) {
    const u = line.trim();
    if (!u || out.includes(u) || u.length > 600) continue;
    try {
      if (new URL(u).protocol === "https:") out.push(u);
    } catch {
      /* пропускаем некорректную строку */
    }
    if (out.length >= 12) break;
  }
  return out;
}

export const rid = () => Math.random().toString(36).slice(2, 8);

// Уникальный адрес (slug) для новой записи
export async function uniqueSlug(run: Run, table: "Product" | "Category", base: string): Promise<string> {
  const root = slugify(base) || "item";
  for (let i = 0; i < 20; i++) {
    const cand = i === 0 ? root : `${root}-${i + 1}`;
    const r = await run(`SELECT 1 AS x FROM "${table}" WHERE slug = $1 LIMIT 1`, [cand]);
    if (!r.length) return cand;
  }
  return `${root}-${rid()}`;
}

export const PRODUCT_LOCKS = ["name", "description", "price", "category", "brand", "images"] as const;
export const LOCK_LABEL: Record<string, string> = {
  name: "название",
  description: "описание",
  price: "цена",
  category: "категория",
  brand: "бренд",
  images: "фото",
  visibility: "видимость",
  sort: "порядок",
};

export const addLocks = (cur: string[], add: string[]) => [...new Set([...cur, ...add])];
