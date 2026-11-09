import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { thumb } from "@/lib/image";

export const dynamic = "force-dynamic";
const PER = 30;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string; ok?: string; qmin?: string; qmax?: string; s?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const f = ["out", "hidden", "edited", "own"].includes(sp.f ?? "") ? (sp.f as string) : "";
  const page = Math.max(1, Number(sp.p) || 1);
  // Фільтр за залишком: «від» і «до» (цілі числа, включно); сортування за залишком
  const toQty = (v?: string) => {
    const t = (v ?? "").trim();
    if (!/^\d{1,7}$/.test(t)) return null;
    return Number(t);
  };
  let qmin = toQty(sp.qmin);
  let qmax = toQty(sp.qmax);
  if (qmin !== null && qmax !== null && qmin > qmax) [qmin, qmax] = [qmax, qmin];
  const sort = ["qty_asc", "qty_desc"].includes(sp.s ?? "") ? (sp.s as string) : "";
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
  if (qmin !== null || qmax !== null) {
    where.push(`"stockSyncedAt" IS NOT NULL`); // точний залишок відомий лише після синхронізації з KeyCRM
    if (qmin !== null) {
      params.push(qmin);
      where.push(`"stockQty" >= $${params.length}`);
    }
    if (qmax !== null) {
      params.push(qmax);
      where.push(`"stockQty" <= $${params.length}`);
    }
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const orderSql = sort === "qty_asc" ? `"stockQty" ASC NULLS LAST, name` : sort === "qty_desc" ? `"stockQty" DESC NULLS LAST, name` : "name";
  const totalRows = await getRunner()(`SELECT count(*)::int AS n FROM "Product" ${whereSql}`, params);
  const total = Number(totalRows[0]?.n ?? 0);
  const rows = await getRunner()(
    `SELECT id, name, "vendorCode", price::float8 AS price, "stockQty", "isAvailable", "isHidden", "externalId", cardinality("lockedFields") AS locks, cardinality("homeFlags") AS flags,
            "stockSyncedAt" IS NOT NULL AS exact,
            (SELECT i.url FROM "ProductImage" i WHERE i."productId" = "Product".id ORDER BY i."sortOrder" LIMIT 1) AS image
     FROM "Product" ${whereSql}
     ORDER BY ${orderSql} LIMIT ${PER + 1} OFFSET ${(page - 1) * PER}`,
    params
  );
  const more = rows.length > PER;
  const list = rows.slice(0, PER);
  const href = (pp: number, ff = f) =>
    `/admin/products?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(ff ? { f: ff } : {}),
      ...(qmin !== null ? { qmin: String(qmin) } : {}),
      ...(qmax !== null ? { qmax: String(qmax) } : {}),
      ...(sort ? { s: sort } : {}),
      ...(pp > 1 ? { p: String(pp) } : {}),
    })}`;
  const qtyActive = qmin !== null || qmax !== null || sort !== "";
  const tabs: [string, string][] = [["", "Усі"], ["out", "Немає в наявності"], ["hidden", "Приховані"], ["edited", "Змінені вручну"], ["own", "Власні"]];

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Товари</h1>
      {sp.ok === "deleted" && <p className="notice">Товар видалено.</p>}
      <p><Link href="/admin/products/new" className="btn-primary">+ Додати товар</Link></p>
      <form action="/admin/products" className="header-search adm-search">
        <input type="search" name="q" defaultValue={q} placeholder="Назва або артикул" aria-label="Пошук" />
        {f && <input type="hidden" name="f" value={f} />}
        {qmin !== null && <input type="hidden" name="qmin" value={qmin} />}
        {qmax !== null && <input type="hidden" name="qmax" value={qmax} />}
        {sort && <input type="hidden" name="s" value={sort} />}
        <button type="submit" className="btn-primary">Знайти</button>
      </form>
      <form action="/admin/products" className="adm-qty">
        {q && <input type="hidden" name="q" value={q} />}
        {f && <input type="hidden" name="f" value={f} />}
        <span className="adm-qty-title">Залишок</span>
        <label>від<input type="number" name="qmin" min="0" step="1" inputMode="numeric" defaultValue={qmin ?? ""} aria-label="Залишок від" /></label>
        <label>до<input type="number" name="qmax" min="0" step="1" inputMode="numeric" defaultValue={qmax ?? ""} aria-label="Залишок до" /></label>
        <label>Порядок
          <select name="s" defaultValue={sort}>
            <option value="">За назвою</option>
            <option value="qty_asc">Залишок: від меншого</option>
            <option value="qty_desc">Залишок: від більшого</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">Застосувати</button>
        {qtyActive && <Link href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { f } : {}) })}`}>Скинути</Link>}
      </form>
      <p className="muted small">Знайдено: {total}{qmin !== null || qmax !== null ? ". Показані лише товари, у яких залишок уже підтягнуто з KeyCRM." : ""}</p>
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
