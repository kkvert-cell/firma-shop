import type { Metadata } from "next";
import Link from "next/link";
import { accountEnabled, getCustomerEmail } from "@/lib/customer-auth";
import { getRunner } from "@/lib/catalog";
import { fmtDate, payChip } from "@/lib/admin-format";
import { formatPrice } from "@/lib/site";
import { thumb } from "@/lib/image";
import type { CartLine } from "@/lib/cart";
import ReorderButton from "@/components/ReorderButton";

export const metadata: Metadata = { title: "Особистий кабінет", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  NEW: "Прийнято",
  CONFIRMED: "Підтверджено",
  PROCESSING: "Комплектується",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
};
const CARRIER: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };
const MSG: Record<string, string> = {
  link: "Посилання недійсне або застаріло. Запросіть нове.",
  email: "Перевірте адресу електронної пошти.",
  off: "Вхід тимчасово недоступний.",
};

type Search = { sent?: string; e?: string };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;

  if (!accountEnabled()) {
    return (
      <main>
        <h1 className="heading page-title">Особистий кабінет</h1>
        <p className="notice">Кабінет скоро з&apos;явиться. Замовлення можна оформити без реєстрації.</p>
        <p><Link href="/catalog">До каталогу →</Link></p>
      </main>
    );
  }

  const email = await getCustomerEmail();
  if (!email) {
    return (
      <main className="adm-login">
        <h1 className="heading page-title">Особистий кабінет</h1>
        <p className="muted">Введіть e-mail, який ви вказували в замовленні, і ми надішлемо посилання для входу. Пароль не потрібен.</p>
        {sp.sent && <p className="notice">Якщо за цією адресою є замовлення, ми надіслали лист із посиланням. Перевірте пошту (і папку «Спам»).</p>}
        {sp.e && MSG[sp.e] && <p className="notice error">{MSG[sp.e]}</p>}
        <form action="/api/account/login" method="post" className="checkout-form">
          <label>E-mail<input type="email" name="email" autoComplete="email" required /></label>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
          <button type="submit" className="btn-primary">Надіслати посилання</button>
        </form>
        <p className="muted small">Не вказували e-mail у замовленні? Тоді кабінет не знайде ваших замовлень, але нове замовлення можна оформити будь-коли.</p>
      </main>
    );
  }

  const run = getRunner();
  const orders = await run(
    `SELECT o.id, o."orderNumber", o."createdAt"::text AS "createdAt", o.status::text AS status, o."totalAmount"::float8 AS total, o."clientToken" AS token,
            s.carrier::text AS carrier, s.city, s.warehouse, p.method::text AS method, p.status::text AS "payStatus"
     FROM "Order" o LEFT JOIN "Shipment" s ON s."orderId" = o.id LEFT JOIN "Payment" p ON p."orderId" = o.id
     WHERE lower(o.email) = $1 ORDER BY o."createdAt" DESC LIMIT 30`,
    [email]
  );
  const items = orders.length
    ? await run(
        `SELECT i."orderId", i.name, i.quantity, pr.id AS pid, pr.slug, pr.name AS "curName", pr.price::float8 AS "curPrice",
                (SELECT im.url FROM "ProductImage" im WHERE im."productId" = pr.id ORDER BY im."sortOrder" LIMIT 1) AS image
         FROM "OrderItem" i LEFT JOIN "Product" pr ON pr.id = i."productId"
         WHERE i."orderId" = ANY($1::text[]) ORDER BY i.name`,
        [orders.map((o) => String(o.id))]
      )
    : [];
  const byOrder = new Map<string, typeof items>();
  for (const it of items) byOrder.set(String(it.orderId), [...(byOrder.get(String(it.orderId)) ?? []), it]);

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Мої замовлення</h1>
      <p className="muted small">
        {email} ·{" "}
        <form action="/api/account/logout" method="post" style={{ display: "inline" }}>
          <button type="submit" className="link-btn">Вийти</button>
        </form>
      </p>
      {orders.length === 0 && <p className="muted">Замовлень поки немає.</p>}
      {orders.map((o) => {
        const its = byOrder.get(String(o.id)) ?? [];
        const pc = payChip(o.method, o.payStatus);
        const lines: CartLine[] = its
          .filter((i) => i.pid)
          .map((i) => ({
            id: String(i.pid),
            slug: String(i.slug ?? ""),
            name: String(i.curName ?? i.name),
            price: Number(i.curPrice ?? 0),
            image: i.image ? thumb(String(i.image), 200) : null,
            qty: Number(i.quantity),
          }));
        return (
          <section key={String(o.orderNumber)} className="card adm-block">
            <h2 className="heading section-title">Замовлення {String(o.orderNumber)}</h2>
            <p className="muted small">{fmtDate(o.createdAt)} · {formatPrice(Number(o.total))} ₴</p>
            <div className="adm-chips">
              <span className="chip mute">{STATUS[String(o.status)] ?? String(o.status)}</span>
              <span className={`chip ${pc.tone}`}>{pc.text}</span>
            </div>
            <ul className="adm-items">
              {its.map((i, idx) => (
                <li key={idx}>
                  <span>{i.slug ? <Link href={`/product/${i.slug}`}>{String(i.name)}</Link> : String(i.name)}</span>
                  <span className="adm-nowrap">× {Number(i.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">{CARRIER[String(o.carrier)] ?? String(o.carrier)}: {String(o.city)}, {String(o.warehouse)}</p>
            <div className="adm-inline">
              <Link href={`/order/${o.orderNumber}?t=${encodeURIComponent(String(o.token))}`} className="btn-secondary">Деталі</Link>
              <ReorderButton lines={lines} />
            </div>
          </section>
        );
      })}
    </main>
  );
}
