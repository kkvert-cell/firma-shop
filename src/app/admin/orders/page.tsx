import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { fmtDate, keycrmChip, payChip, STATUS_LABEL } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const PER = 30;
const FILTERS: Record<string, { label: string; where: string }> = {
  all: { label: "Усі", where: "TRUE" },
  new: { label: "Нові", where: `o.status = 'NEW'` },
  unpaid: { label: "Очікують оплати", where: `p.method = 'ONLINE_CARD' AND p.status <> 'PAID'` },
  keycrm: { label: "Не в KeyCRM", where: `o."keycrmOrderId" IS NULL AND o."keycrmAttempts" < 99 AND NOT (p.method = 'ONLINE_CARD' AND p.status <> 'PAID')` },
};

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ f?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = sp.f && FILTERS[sp.f] ? sp.f : "all";
  const page = Math.max(1, Number(sp.p) || 1);
  const rows = await getRunner()(
    `SELECT o."orderNumber", o."createdAt"::text AS "createdAt", o.status::text AS status, o."firstName", o."lastName", o.phone,
            o."totalAmount"::float8 AS total, o."keycrmOrderId", o."keycrmAttempts", p.method::text AS method, p.status::text AS "payStatus"
     FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id
     WHERE ${FILTERS[f].where}
     ORDER BY o."createdAt" DESC LIMIT ${PER + 1} OFFSET ${(page - 1) * PER}`
  );
  const more = rows.length > PER;
  const list = rows.slice(0, PER);
  const href = (ff: string, pp = 1) => `/admin/orders?f=${ff}${pp > 1 ? `&p=${pp}` : ""}`;

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Замовлення</h1>
      <div className="adm-tabs">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Link key={k} href={href(k)} className={k === f ? "active" : ""}>{v.label}</Link>
        ))}
      </div>
      {list.length === 0 && <p className="muted">Тут поки нічого немає.</p>}
      <ul className="adm-list">
        {list.map((o) => {
          const pc = payChip(o.method, o.payStatus);
          const kc = keycrmChip(o);
          return (
            <li key={String(o.orderNumber)}>
              <Link href={`/admin/orders/${o.orderNumber}`} className="adm-row">
                <span className="adm-row-main"><b>{String(o.orderNumber)}</b> · {String(o.lastName)} {String(o.firstName)}</span>
                <span className="adm-row-sub">{fmtDate(o.createdAt)} · {formatPrice(Number(o.total))} ₴ · {String(o.phone)}</span>
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
      <p className="adm-pager">
        {page > 1 && <Link href={href(f, page - 1)}>← Новіші</Link>}
        {more && <Link href={href(f, page + 1)}>Старіші →</Link>}
      </p>
    </main>
  );
}
