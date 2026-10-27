import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { fmtDate, keycrmChip, payChip, STATUS_LABEL } from "@/lib/admin-format";
import { getState } from "@/lib/sync-state";
import { loadPromState } from "@/lib/prom-refresh";

export const dynamic = "force-dynamic";

const KYIV_CREATED = `("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')`;
const KYIV_NOW = `(now() AT TIME ZONE 'Europe/Kyiv')`;

export default async function AdminDashboard() {
  await requireAdmin();
  const run = getRunner();
  const [stats, prod, recent, lastRun, prom] = await Promise.all([
    run(`SELECT
           count(*) FILTER (WHERE status = 'NEW')::int AS "newCount",
           count(*) FILTER (WHERE "keycrmOrderId" IS NULL AND "keycrmAttempts" >= 6 AND "keycrmAttempts" < 99)::int AS "keycrmBad",
           count(*) FILTER (WHERE date_trunc('day', ${KYIV_CREATED}) = date_trunc('day', ${KYIV_NOW}))::int AS today,
           coalesce(sum("totalAmount") FILTER (WHERE date_trunc('month', ${KYIV_CREATED}) = date_trunc('month', ${KYIV_NOW}) AND status <> 'CANCELLED'), 0)::float8 AS "monthSum",
           count(*) FILTER (WHERE date_trunc('month', ${KYIV_CREATED}) = date_trunc('month', ${KYIV_NOW}) AND status <> 'CANCELLED')::int AS "monthCount"
         FROM "Order"`),
    run(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE NOT "isAvailable" OR "stockQty" <= 0)::int AS "outOfStock",
                max("stockSyncedAt")::text AS "syncedAt"
         FROM "Product"`),
    run(`SELECT o."orderNumber", o."createdAt"::text AS "createdAt", o.status::text AS status, o."firstName", o."lastName",
                o."totalAmount"::float8 AS total, o."keycrmOrderId", o."keycrmAttempts", p.method::text AS method, p.status::text AS "payStatus"
         FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id ORDER BY o."createdAt" DESC LIMIT 8`),
    getState(run, "keycrm_last_run"),
    loadPromState(run),
  ]);
  const s = stats[0] ?? {};
  const p = prod[0] ?? {};
  const problems = Number(s.keycrmBad ?? 0);

  const cards: { label: string; value: string; href?: string; tone?: string }[] = [
    { label: "Нові замовлення", value: String(s.newCount ?? 0), href: "/admin/orders?f=new", tone: Number(s.newCount) > 0 ? "warn" : undefined },
    { label: "Замовлень сьогодні", value: String(s.today ?? 0) },
    { label: "Продажі за місяць", value: `${formatPrice(Number(s.monthSum ?? 0))} ₴ (${s.monthCount ?? 0})` },
    { label: "Немає в наявності", value: `${p.outOfStock ?? 0} з ${p.total ?? 0}`, href: "/admin/products?f=out" },
  ];

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Огляд</h1>
      {problems > 0 && (
        <p className="notice error">Є замовлення, які не потрапили в KeyCRM. <Link href="/admin/orders?f=keycrm">Подивитись</Link></p>
      )}
      <div className="adm-cards">
        {cards.map((c) => {
          const inner = (
            <>
              <span className="adm-card-label">{c.label}</span>
              <span className={`adm-card-value${c.tone ? " " + c.tone : ""}`}>{c.value}</span>
            </>
          );
          return c.href ? <Link key={c.label} href={c.href} className="adm-card">{inner}</Link> : <div key={c.label} className="adm-card">{inner}</div>;
        })}
      </div>
      <p className="muted small">
        {p.syncedAt ? `Залишки з KeyCRM оновлено: ${fmtDate(p.syncedAt)} (київський час).` : "Залишки з KeyCRM ще не оновлювались."}
        {lastRun ? "" : " Автооновлення ще не запускалось."}
        {" "}
        {prom.active ? "Каталог з Prom оновлюється зараз." : prom.lastDone ? `Ціни з Prom оновлено: ${fmtDate(prom.lastDone)}.` : "Ціни з Prom ще не оновлювались автоматично."}
      </p>

      <h2 className="heading section-title">Останні замовлення</h2>
      {recent.length === 0 && <p className="muted">Замовлень ще немає.</p>}
      <ul className="adm-list">
        {recent.map((o) => {
          const pc = payChip(o.method, o.payStatus);
          const kc = keycrmChip(o);
          return (
            <li key={String(o.orderNumber)}>
              <Link href={`/admin/orders/${o.orderNumber}`} className="adm-row">
                <span className="adm-row-main"><b>{String(o.orderNumber)}</b> · {String(o.lastName)} {String(o.firstName)}</span>
                <span className="adm-row-sub">{fmtDate(o.createdAt)} · {formatPrice(Number(o.total))} ₴</span>
                <span className="adm-chips">
                  <span className="chip mute">{STATUS_LABEL[String(o.status)] ?? String(o.status)}</span>
                  <span className={`chip ${pc.tone}`}>{pc.text}</span>
                  <span className={`chip ${kc.tone}`}>{kc.text}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p><Link href="/admin/orders">Усі замовлення →</Link></p>
    </main>
  );
}
