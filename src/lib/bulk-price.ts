// Масова зміна цін в адмінці: розбір параметрів, умови вибору товарів і формула нової ціни.
import { SALE_ACTIVE } from "./sales";

// Увага: у товарів без знижки SALE_ACTIVE дорівнює NULL, тому для «не на знижці» потрібен COALESCE
export const ON_SALE = `COALESCE(${SALE_ACTIVE}, false)`;

export type BulkParams = {
  scope: "all" | "category";
  categoryId: string;
  brandId: string;
  inStock: boolean;
  mode: "amount" | "percent";
  dir: "up" | "down";
  value: number | null; // null — не вказано, NaN — помилка
};

const ID = /^[A-Za-z0-9_-]{6,64}$/;

export function parseBulk(get: (k: string) => string | null | undefined): BulkParams {
  const s = (k: string) => String(get(k) ?? "").trim();
  const raw = s("val").replace(/\s/g, "").replace(",", ".");
  const num = raw === "" ? null : Number(raw);
  return {
    scope: s("scope") === "category" ? "category" : "all",
    categoryId: ID.test(s("cat")) ? s("cat") : "",
    brandId: ID.test(s("brand")) ? s("brand") : "",
    inStock: s("stock") === "1",
    mode: s("mode") === "percent" ? "percent" : "amount",
    dir: s("dir") === "down" ? "down" : "up",
    value: num === null ? null : Number.isFinite(num) ? num : NaN,
  };
}

// Помилка в значенні (або null, якщо все гаразд)
export function bulkError(b: BulkParams): string | null {
  if (b.scope === "category" && !b.categoryId) return "Виберіть категорію зі списку";
  if (b.value === null || Number.isNaN(b.value) || b.value <= 0) return "Вкажіть число більше нуля";
  if (b.mode === "percent" && b.value > 500) return "Відсоток не може бути більшим за 500";
  if (b.mode === "percent" && b.dir === "down" && b.value >= 100) return "Знизити можна менш ніж на 100%";
  if (b.mode === "amount" && b.value >= 1_000_000) return "Занадто велика сума";
  return null;
}

// Вибір товарів: категорія (разом з підкатегоріями), бренд, наявність. Товари з діючою знижкою не чіпаємо.
export function scopeWhere(b: BulkParams, params: unknown[], opts: { skipSale: boolean }): string {
  const w: string[] = [`p.price > 0`];
  if (b.scope === "category") {
    params.push(b.categoryId);
    w.push(
      `p."categoryId" IN (SELECT c2.id FROM "Category" c2 JOIN "Category" t ON t.id = $${params.length}::text AND (c2.path = t.path OR c2.path LIKE t.path || ' > %'))`
    );
  }
  if (b.brandId) {
    params.push(b.brandId);
    w.push(`p."brandId" = $${params.length}::text`);
  }
  if (b.inStock) w.push(`p."isAvailable" = true`);
  if (opts.skipSale) w.push(`NOT ${ON_SALE}`);
  return w.join(" AND ");
}

// Нова ціна (SQL). У відсотках: результат округлюється ВГОРУ до десятків (253 → 260, 198 → 200).
// У гривнях: ціна змінюється рівно на вказану суму.
export function newPriceSql(b: BulkParams, params: unknown[]): string {
  const v = b.value as number;
  if (b.mode === "percent") {
    params.push(b.dir === "up" ? 100 + v : 100 - v);
    return `(CEIL(p.price * $${params.length}::numeric / 1000) * 10)`;
  }
  params.push(b.dir === "up" ? v : -v);
  return `ROUND(p.price + $${params.length}::numeric, 2)`;
}

export const BULK_KEYS = ["scope", "cat", "brand", "stock", "mode", "dir", "val"] as const;

// Коли ціну справді можна змінити: нова ціна більша за нуль, а напрямок збігається з вибраним
// (округлення вгору не повинно підняти ціну, якщо її треба знизити: 9 ₴ −10% не стане 10 ₴)
export function changeCond(b: BulkParams, next: string): string {
  return `${next} > 0 AND ${next} ${b.dir === "up" ? ">" : "<"} p.price`;
}
