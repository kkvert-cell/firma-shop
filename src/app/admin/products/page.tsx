import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { thumb } from "@/lib/image";

export const dynamic = "force-dynamic";
const PER = 30;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string; ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const f = ["out", "hidden", "edited", "own"].includes(sp.f ?? "") ? (sp.f as string) : "";
  const page = Math.max(1, Number(sp.p) || 1);
  const params: unknown[] = [];
  const where: string[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR "vendorCode" ILIKE $${params.length})`);
  }
  if (f === "out") where.push(`(NOT "isAvailable" OR "stockQty" <= 0)`);
  if (f === "hidden") where.push(`"isHidden"`);
  if (f === "edited") where.push(`cardinality("lockedFields") > 0`);
  if (f === "own") where.push(`"externalId" IS NULL`);
  const rows = await getRunner()(
    `SELECT id, name, "vendorCode", price::float8 AS price, "stockQty", "isAvailable", "isHidden", "externalId", cardinality("lockedFields") AS locks, cardinality("homeFlags") AS flags,
            "stockSyncedAt" IS NOT NULL AS exact,
            (SELECT i.url FROM "ProductImage" i WHERE i."productId" = "Product".id ORDER BY i."sortOrder" LIMIT 1) AS image
     FROM "Product" ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY name LIMIT ${PER + 1} OFFSET ${(page - 1) * PER}`,
    params
  );
  const more = rows.length > PER;
  const list = rows.slice(0, PER);
  const href = (pp: number, ff = f) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(ff ? { f: ff } : {}), ...(pp > 1 ? { p: String(pp) } : {}) })}`;
  const tabs: [string, string][] = [["", "Усі"], ["out", "Немає в наявності"], ["hidden", "Приховані"], ["edited", "Змінені вручну"], ["own", "Власні"]];

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Товари</h1>
      {sp.ok === "deleted" && <p className="notice">Товар видалено.</p>}
      <p><Link href="/admin/products/new" className="btn-primary">+ Додати товар</Link></p>
      <form action="/admin/products" className="header-search adm-search">
        <input type="search" name="q" defaultValue={q} placeholder="Назва або артикул" aria-label="Пошук" />
        {f && <input type="hidden" name="f" value={f} />}
        <button type="submit" className="btn-primary">Знайти</button>
      </form>
      <div className="adm-tabs">
        {tabs.map(([k, label]) => <Link key={k} href={href(1, k)} className={f === k ? "active" : ""}>{label}</Link>)}
      </div>
      {list.length === 0 && <p className="muted">Нічого не знайдено.</p>}
      <ul className="adm-list">
        {list.map((p) => (
          <li key={String(p.id)}>
            <Link href={`/admin/products/${p.id}`} className="adm-row adm-product-row">
              {p.image ? <img src={thumb(String(p.image), 100)} alt="" width={56} height={56} loading="lazy" /> : <span className="adm-noimg" aria-hidden="true" />}
              <span className="adm-product-info">
                <span className="adm-row-main">{String(p.name)}</span>
                <span className="adm-row-sub">арт. {String(p.vendorCode ?? "—")} · {formatPrice(Number(p.price))} ₴ · залишок: {p.exact ? Number(p.stockQty) : "—"}</span>
                <span className="adm-chips">
                  {Boolean(p.isHidden) && <span className="chip bad">приховано на сайті</span>}
                  {!p.isHidden && <span className={`chip ${p.isAvailable && (!p.exact || Number(p.stockQty) > 0) ? "ok" : "warn"}`}>{p.isAvailable && (!p.exact || Number(p.stockQty) > 0) ? "є в наявності" : "немає в наявності"}</span>}
                  {!p.externalId && <span className="chip mute">власний товар</span>}
                  {Number(p.locks) > 0 && <span className="chip mute">змінено вручну</span>}
                  {Number(p.flags) > 0 && <span className="chip ok">на головній</span>}
                </span>
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
