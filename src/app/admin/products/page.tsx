import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { fmtDate } from "@/lib/admin-format";

export const dynamic = "force-dynamic";
const PER = 30;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const out = sp.f === "out";
  const page = Math.max(1, Number(sp.p) || 1);
  const params: unknown[] = [];
  const where: string[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR "vendorCode" ILIKE $${params.length})`);
  }
  if (out) where.push(`(NOT "isAvailable" OR "stockQty" <= 0)`);
  const rows = await getRunner()(
    `SELECT slug, name, "vendorCode", price::float8 AS price, "stockQty", "isAvailable", "stockSyncedAt"::text AS "syncedAt"
     FROM "Product" ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY name LIMIT ${PER + 1} OFFSET ${(page - 1) * PER}`,
    params
  );
  const more = rows.length > PER;
  const list = rows.slice(0, PER);
  const href = (pp: number) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(out ? { f: "out" } : {}), ...(pp > 1 ? { p: String(pp) } : {}) })}`;

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Товари</h1>
      <p className="muted small">Ціни й описи приходять з Prom, залишки — з KeyCRM (оновлюються автоматично). Тут їх можна лише переглядати.</p>
      <form action="/admin/products" className="header-search adm-search">
        <input type="search" name="q" defaultValue={q} placeholder="Назва або артикул" aria-label="Пошук" />
        {out && <input type="hidden" name="f" value="out" />}
        <button type="submit" className="btn-primary">Знайти</button>
      </form>
      <div className="adm-tabs">
        <Link href={q ? `/admin/products?q=${encodeURIComponent(q)}` : "/admin/products"} className={!out ? "active" : ""}>Усі</Link>
        <Link href={`/admin/products?f=out${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={out ? "active" : ""}>Немає в наявності</Link>
      </div>
      {list.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      <ul className="adm-list">
        {list.map((p) => (
          <li key={String(p.slug)}>
            <Link href={`/product/${p.slug}`} className="adm-row">
              <span className="adm-row-main">{String(p.name)}</span>
              <span className="adm-row-sub">арт. {String(p.vendorCode ?? "—")} · {formatPrice(Number(p.price))} ₴ · залишок: {p.syncedAt ? Number(p.stockQty) : "—"}</span>
              <span className="adm-chips">
                <span className={`chip ${p.isAvailable && Number(p.stockQty) > 0 ? "ok" : "bad"}`}>{p.isAvailable && Number(p.stockQty) > 0 ? "є в наявності" : "немає"}</span>
                <span className="chip mute">залишок оновлено: {fmtDate(p.syncedAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="adm-pager">
        {page > 1 && <Link href={href(page - 1)}>← Назад</Link>}
        {more && <Link href={href(page + 1)}>Далі →</Link>}
      </p>
    </main>
  );
}
