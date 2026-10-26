import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRunner } from "@/lib/catalog";
import { SHOP_PHONE, SHOP_PHONE_TEXT, SITE_URL, formatPrice } from "@/lib/site";
import { buildPayForm } from "@/lib/payments";
import PayForm from "@/components/PayForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Замовлення прийнято", robots: { index: false, follow: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const CARRIER: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };
const PAY: Record<string, string> = {
  CASH_ON_DELIVERY: "Накладений платіж (оплата при отриманні)",
  BANK_TRANSFER: "Оплата за реквізитами (менеджер надішле їх вам)",
  ONLINE_CARD: "Оплата карткою онлайн",
};

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params;
  const t = (await searchParams).t;
  const token = Array.isArray(t) ? t[0] : t;
  if (!token || !/^F-\d+$/.test(number)) notFound();

  let order, items, ship;
  try {
    const run = getRunner();
    const rows = await run(
      `SELECT o.id, o."orderNumber", o."totalAmount"::float8 AS total, o.comment, o."firstName", p.method, p.status AS "payStatus"
       FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id
       WHERE o."orderNumber" = $1 AND o."clientToken" = $2`,
      [number, token]
    );
    order = rows[0];
    if (order) {
      [items, ship] = await Promise.all([
        run(`SELECT name, quantity, price::float8 AS price FROM "OrderItem" WHERE "orderId" = $1 ORDER BY name`, [order.id]),
        run(`SELECT carrier, city, warehouse FROM "Shipment" WHERE "orderId" = $1`, [order.id]),
      ]);
    }
  } catch (err) {
    console.error("order page:", err);
    return <main><p className="empty-state">Сторінка тимчасово недоступна. Ваше замовлення збережено — ми з вами зв&apos;яжемось.</p></main>;
  }
  if (!order) notFound();
  const s = ship?.[0];
  const needsPayment = String(order.method) === "ONLINE_CARD" && String(order.payStatus) !== "PAID" && String(order.payStatus) !== "REFUNDED";
  const payForm = needsPayment
    ? buildPayForm({
        orderNumber: String(order.orderNumber),
        token,
        total: Number(order.total),
        items: (items ?? []).map((it) => ({ name: String(it.name), qty: Number(it.quantity), price: Number(it.price) })),
        siteUrl: SITE_URL,
      })
    : null;
  const autoPay = (Array.isArray((await searchParams).pay) ? (await searchParams).pay?.[0] : (await searchParams).pay) === "1";

  return (
    <main>
      <h1 className="heading page-title">Дякуємо, {String(order.firstName)}! Замовлення {String(order.orderNumber)} прийнято</h1>
      {String(order.method) === "ONLINE_CARD" && String(order.payStatus) === "PAID" && (
        <p className="notice">✓ Оплату отримано. Дякуємо!</p>
      )}
      {payForm && (
        <div className="card order-box">
          <h2 className="heading section-title">Оплата карткою</h2>
          <p className="muted">Замовлення буде передано в обробку одразу після оплати. Якщо ви вже заплатили, статус оновиться протягом хвилини.</p>
          <PayForm action={payForm.action} fields={payForm.fields} auto={autoPay} label={`Сплатити ${formatPrice(Number(order.total))} ₴`} />
        </div>
      )}
      {needsPayment && !payForm && (
        <p className="notice error">Онлайн-оплата тимчасово недоступна. Ми зв&apos;яжемось з вами та запропонуємо інший спосіб оплати.</p>
      )}
      <p className="muted">Менеджер зв&apos;яжеться з вами найближчим часом для підтвердження. Якщо потрібно швидше — зателефонуйте: <a href={`tel:${SHOP_PHONE}`}>{SHOP_PHONE_TEXT}</a>.</p>

      <div className="card order-box">
        <h2 className="heading section-title">Склад замовлення</h2>
        <table className="specs">
          <tbody>
            {(items ?? []).map((it, i) => (
              <tr key={i}>
                <td>{String(it.name)}</td>
                <td className="data">{Number(it.quantity)} × {formatPrice(Number(it.price))} ₴</td>
              </tr>
            ))}
            <tr>
              <td><strong>Разом</strong></td>
              <td className="data"><strong>{formatPrice(Number(order.total))} ₴</strong></td>
            </tr>
          </tbody>
        </table>
        {s && <p className="muted">Доставка: {CARRIER[String(s.carrier)] ?? String(s.carrier)}, {String(s.city)}, {String(s.warehouse)}</p>}
        <p className="muted">Оплата: {PAY[String(order.method)] ?? "—"}{String(order.method) === "ONLINE_CARD" ? (String(order.payStatus) === "PAID" ? " — сплачено" : " — очікує оплати") : ""}</p>
        <p className="muted">Вартість доставки сплачується за тарифами перевізника.</p>
      </div>

      <p><Link href="/">← Продовжити покупки</Link></p>
    </main>
  );
}
