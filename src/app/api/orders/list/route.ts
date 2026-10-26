// Приватний список останніх замовлень (для власника) зі статусом передачі в KeyCRM.
//   /api/orders/list?key=<SYNC_SECRET>
import { NextRequest } from "next/server";
import { getRunner } from "@/lib/catalog";
import { checkKey, esc, htmlPage } from "@/lib/sync-page";
import { formatPrice } from "@/lib/site";

export const dynamic = "force-dynamic";

const CARRIER: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };
const PAY: Record<string, string> = { CASH_ON_DELIVERY: "накладений платіж", BANK_TRANSFER: "за реквізитами", ONLINE_CARD: "картка онлайн" };

type OrderRow = Record<string, unknown>;

function keycrmLabel(o: OrderRow): string {
  const num = esc(String(o.orderNumber));
  const resend = ` <a href="/api/orders/send?key=${KEY_PLACEHOLDER}&number=${num}">${"надіслати в KeyCRM ще раз"}</a>`;
  if (o.keycrmOrderId) return `<span style="color:#117a2b">✓ у KeyCRM, замовлення №${esc(String(o.keycrmOrderId))}</span>`;
  if (Number(o.keycrmAttempts) >= 99) return `<span style="color:#777">не передається автоматично (старе/тестове)</span>${resend}`;
  if (Number(o.keycrmAttempts) >= 6) return `<span style="color:#b00020">✗ не передано, спроби закінчились: ${esc(String(o.keycrmError ?? ""))}</span>${resend}`;
  if (o.keycrmError) return `<span style="color:#b36b00">… ще не передано (спроб: ${Number(o.keycrmAttempts)}), пробуємо далі: ${esc(String(o.keycrmError))}</span>`;
  return `<span style="color:#b36b00">… передаємо в KeyCRM</span>`;
}

const KEY_PLACEHOLDER = "@@KEY@@";

export async function GET(req: NextRequest) {
  const denied = checkKey(req);
  if (denied) return denied;
  try {
    const run = getRunner();
    const orders = await run(
      `SELECT o.id, o."orderNumber", o."createdAt", o."firstName", o."lastName", o.phone, o.email, o.comment,
              o."totalAmount"::float8 AS total, o.status, o."keycrmOrderId", o."keycrmAttempts", o."keycrmError", s.carrier, s.city, s.warehouse, p.method
       FROM "Order" o
       LEFT JOIN "Shipment" s ON s."orderId" = o.id
       LEFT JOIN "Payment" p ON p."orderId" = o.id
       ORDER BY o."createdAt" DESC LIMIT 50`
    );
    const ids = orders.map((o) => String(o.id));
    const items = ids.length
      ? await run(`SELECT "orderId", name, "vendorCode", quantity, price::float8 AS price FROM "OrderItem" WHERE "orderId" = ANY($1::text[]) ORDER BY name`, [ids])
      : [];
    const fmt = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });
    const html = orders
      .map((o) => {
        const its = items.filter((i) => i.orderId === o.id);
        return `<div style="border:1px solid #ccc;border-radius:6px;padding:12px;margin:12px 0">
          <b>${esc(String(o.orderNumber))}</b> · ${esc(fmt.format(new Date(o.createdAt as string)))} · ${esc(String(o.status))}<br>
          ${keycrmLabel(o)}<br>
          ${esc(String(o.firstName))} ${esc(String(o.lastName))}, <a href="tel:${esc(String(o.phone))}">${esc(String(o.phone))}</a>${o.email ? ", " + esc(String(o.email)) : ""}<br>
          ${esc(CARRIER[String(o.carrier)] ?? String(o.carrier))}: ${esc(String(o.city))}, ${esc(String(o.warehouse))} · оплата: ${esc(PAY[String(o.method)] ?? String(o.method))}<br>
          ${o.comment ? "Коментар: " + esc(String(o.comment)) + "<br>" : ""}
          <ul>${its.map((i) => `<li>${esc(String(i.name))}${i.vendorCode ? " [" + esc(String(i.vendorCode)) + "]" : ""} — ${Number(i.quantity)} × ${formatPrice(Number(i.price))} ₴</li>`).join("")}</ul>
          <b>Разом: ${formatPrice(Number(o.total))} ₴</b></div>`;
      })
      .join("");
    const key = encodeURIComponent(req.nextUrl.searchParams.get("key") ?? "");
    return htmlPage(`<h3>Останні замовлення (${orders.length})</h3>${(html || "<p>Замовлень ще немає.</p>").split(KEY_PLACEHOLDER).join(key)}`);
  } catch (e) {
    return htmlPage(`<h3>Помилка</h3><pre style="white-space:pre-wrap">${esc(e instanceof Error ? e.message : String(e))}</pre>`, 500);
  }
}
