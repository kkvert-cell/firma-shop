import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { CARRIER_LABEL, fmtDate, keycrmChip, payChip, STATUSES, STATUS_LABEL } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const NOTE: Record<string, string> = {
  status: "Статус змінено.",
  keycrm: "Замовлення передано в KeyCRM.",
};

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const { number } = await params;
  const sp = await searchParams;
  if (!/^F-\d+$/.test(number)) notFound();
  const run = getRunner();
  const rows = await run(
    `SELECT o.id, o."orderNumber", o."createdAt"::text AS "createdAt", o.status::text AS status, o."firstName", o."lastName", o.phone, o.email,
            o.comment, o."totalAmount"::float8 AS total, o."keycrmOrderId", o."keycrmAttempts", o."keycrmError", o."clientToken" AS token,
            s.carrier::text AS carrier, s.city, s.warehouse, p.method::text AS method, p.status::text AS "payStatus", p."providerRef",
            p."paidAt"::text AS "paidAt"
     FROM "Order" o LEFT JOIN "Shipment" s ON s."orderId" = o.id LEFT JOIN "Payment" p ON p."orderId" = o.id
     WHERE o."orderNumber" = $1`,
    [number]
  );
  const o = rows[0];
  if (!o) notFound();
  const items = await run(
    `SELECT i.name, i."vendorCode", i.quantity, i.price::float8 AS price, pr.slug
     FROM "OrderItem" i LEFT JOIN "Product" pr ON pr.id = i."productId" WHERE i."orderId" = $1 ORDER BY i.name`,
    [o.id]
  );
  const pc = payChip(o.method, o.payStatus);
  const kc = keycrmChip(o);
  const canResend = !o.keycrmOrderId && Number(o.keycrmAttempts) < 99 || (!o.keycrmOrderId && Number(o.keycrmAttempts) >= 99);
  const waitingPay = String(o.method) === "ONLINE_CARD" && String(o.payStatus) !== "PAID";

  return (
    <main className="adm-main">
      <p><Link href="/admin/orders">← Усі замовлення</Link></p>
      <h1 className="heading page-title">Замовлення {String(o.orderNumber)}</h1>
      {sp.ok && NOTE[sp.ok] && <p className="notice">{NOTE[sp.ok]}</p>}
      {sp.err && <p className="notice error">Не вдалося передати в KeyCRM: {sp.err}</p>}

      <div className="adm-chips">
        <span className="chip mute">{STATUS_LABEL[String(o.status)] ?? String(o.status)}</span>
        <span className={`chip ${pc.tone}`}>{pc.text}</span>
        <span className={`chip ${kc.tone}`}>{kc.text}</span>
      </div>
      <p className="muted small">Створено: {fmtDate(o.createdAt)} (київський час)</p>

      <section className="card adm-block">
        <h2 className="heading section-title">Покупець</h2>
        <p><b>{String(o.lastName)} {String(o.firstName)}</b><br />
          <a href={`tel:${o.phone}`}>{String(o.phone)}</a>{o.email ? <> · <a href={`mailto:${o.email}`}>{String(o.email)}</a></> : null}</p>
        {o.comment ? <p>Коментар: {String(o.comment)}</p> : null}
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Доставка й оплата</h2>
        <p>{CARRIER_LABEL[String(o.carrier)] ?? String(o.carrier)}: {String(o.city)}, {String(o.warehouse)}</p>
        <p>Оплата: {pc.text}{o.paidAt ? ` (${fmtDate(o.paidAt)})` : ""}{o.providerRef ? <span className="muted small"> · id платежу {String(o.providerRef)}</span> : null}</p>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Товари</h2>
        <ul className="adm-items">
          {items.map((i, idx) => (
            <li key={idx}>
              <span>{i.slug ? <Link href={`/product/${i.slug}`}>{String(i.name)}</Link> : String(i.name)}
                {i.vendorCode ? <span className="muted small"> · арт. {String(i.vendorCode)}</span> : null}</span>
              <span className="adm-nowrap">{Number(i.quantity)} × {formatPrice(Number(i.price))} ₴</span>
            </li>
          ))}
        </ul>
        <p><b>Разом: {formatPrice(Number(o.total))} ₴</b> <span className="muted small">(без доставки)</span></p>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">KeyCRM</h2>
        {o.keycrmOrderId ? (
          <p>Передано, номер у KeyCRM: <b>{String(o.keycrmOrderId)}</b>.</p>
        ) : waitingPay ? (
          <p className="muted">Замовлення піде в KeyCRM одразу після оплати карткою.</p>
        ) : (
          <>
            <p>Ще не в KeyCRM (спроб: {Number(o.keycrmAttempts) >= 99 ? "—" : Number(o.keycrmAttempts)}).{o.keycrmError ? <> Причина: <span className="adm-err">{String(o.keycrmError)}</span></> : null}</p>
            {canResend && (
              <form action="/api/admin/orders/resend" method="post">
                <input type="hidden" name="number" value={String(o.orderNumber)} />
                <button type="submit" className="btn-primary">Передати в KeyCRM зараз</button>
              </form>
            )}
          </>
        )}
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Статус на сайті</h2>
        <p className="muted small">Основна робота з замовленням ведеться в KeyCRM; цей статус потрібен лише для огляду тут.</p>
        <form action="/api/admin/orders/status" method="post" className="adm-inline">
          <input type="hidden" name="number" value={String(o.orderNumber)} />
          <select name="status" defaultValue={String(o.status)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button type="submit" className="btn-primary">Зберегти</button>
        </form>
      </section>
    </main>
  );
}
