import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { SALE_ACTIVE } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function AdminSales({ searchParams }: { searchParams: Promise<{ ok?: string; n?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const run = getRunner();
  const [stat, rows] = await Promise.all([
    run(
      `SELECT count(*)::int AS active,
              count(*) FILTER (WHERE p."saleEndsAt" < now() + interval '3 days')::int AS soon
         FROM "Product" p WHERE ${SALE_ACTIVE}`
    ),
    run(
      `SELECT p.id, p.name, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice",
              to_char(p."saleStartsAt" AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YYYY') AS "from",
              to_char(p."saleEndsAt" AT TIME ZONE 'Europe/Kyiv', 'DD.MM.YYYY') AS "to"
         FROM "Product" p WHERE ${SALE_ACTIVE}
        ORDER BY p."saleEndsAt", p.name LIMIT 100`
    ),
  ]);
  const active = Number(stat[0]?.active ?? 0);
  const soon = Number(stat[0]?.soon ?? 0);
  const msg =
    sp.ok === "extended" ? `Готово: нова дата закінчення встановлена для ${sp.n ?? 0} товарів.` : sp.ok === "ended" ? `Готово: акції завершено (${sp.n ?? 0} товарів повернулися до звичайної ціни).` : null;

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Акції</h1>
      {msg && <p className="notice">{msg}</p>}
      {sp.err && <p className="notice error">{sp.err}</p>}
      <p className="muted">
        Знижка показується покупцям лише доки діє: біля товару вказано дату закінчення. Після цієї дати ціна сама повертається до звичайної.
        Знижки з Prom отримують строк 14 днів від першої появи, далі його можна змінити тут або в картці товару.
      </p>
      <div className="adm-cards">
        <div className="adm-card"><span className="adm-card-label">Діючих акцій</span><span className="adm-card-value">{active}</span></div>
        <div className={`adm-card`}><span className="adm-card-label">Закінчуються за 3 дні</span><span className={`adm-card-value${soon ? " warn" : ""}`}>{soon}</span></div>
      </div>

      <section className="card adm-block">
        <h2 className="heading section-title">Змінити дату закінчення для всіх діючих акцій</h2>
        <form action="/api/admin/sales" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="extend" />
          <label>Нова дата закінчення (включно)<input type="date" name="date" required /></label>
          <button type="submit" className="btn-primary">Зберегти дату</button>
        </form>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Завершити всі акції зараз</h2>
        <form action="/api/admin/sales" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="end_all" />
          <label className="check"><input type="checkbox" name="confirm" value="yes" /> Так, завершити всі акції: товари повернуться до звичайної ціни</label>
          <button type="submit" className="btn-secondary">Завершити акції</button>
        </form>
      </section>

      <h2 className="heading section-title">Діючі акції{rows.length >= 100 ? " (перші 100)" : ""}</h2>
      {rows.length === 0 ? (
        <p className="empty-state">Зараз немає діючих акцій.</p>
      ) : (
        <ul className="adm-list">
          {rows.map((r) => (
            <li key={String(r.id)}>
              <Link href={`/admin/products/${String(r.id)}`} className="adm-row">
                <strong>{String(r.name)}</strong>
                <span className="adm-row-sub">
                  {formatPrice(Number(r.oldPrice))} ₴ → {formatPrice(Number(r.price))} ₴ · з {String(r.from ?? "—")} до {String(r.to)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
