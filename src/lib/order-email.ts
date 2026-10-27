// Складає й надсилає покупцю лист про замовлення. Якщо пошту не вказано або сервіс не підключено — нічого не робить.
import type { Run } from "./catalog";
import { sendMail } from "./mail";
import { SHOP_PHONE_TEXT, SITE_NAME, SITE_URL, formatPrice } from "./site";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CARRIER: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };
const PAY: Record<string, string> = { CASH_ON_DELIVERY: "накладений платіж", BANK_TRANSFER: "за реквізитами (менеджер надішле рахунок)", ONLINE_CARD: "картка онлайн" };

export async function sendOrderEmail(run: Run, orderNumber: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return false;
  const rows = await run(
    `SELECT o.id, o.email, o."firstName", o."clientToken" AS token, o."totalAmount"::float8 AS total,
            s.carrier::text AS carrier, s.city, s.warehouse, p.method::text AS method, p.status::text AS "payStatus"
     FROM "Order" o LEFT JOIN "Shipment" s ON s."orderId" = o.id LEFT JOIN "Payment" p ON p."orderId" = o.id
     WHERE o."orderNumber" = $1`,
    [orderNumber]
  );
  const o = rows[0];
  if (!o || !o.email) return false;
  const items = await run(`SELECT name, quantity, price::float8 AS price FROM "OrderItem" WHERE "orderId" = $1 ORDER BY name`, [o.id]);
  const paid = String(o.method) === "ONLINE_CARD" && String(o.payStatus) === "PAID";
  const link = `${SITE_URL}/order/${orderNumber}?t=${encodeURIComponent(String(o.token))}`;

  const lines = items
    .map((i) => `<tr><td style="padding:4px 12px 4px 0">${esc(i.name)}</td><td style="padding:4px 12px 4px 0;white-space:nowrap">${Number(i.quantity)} × ${formatPrice(Number(i.price))} ₴</td></tr>`)
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">
<h2 style="margin:0 0 12px">Дякуємо за замовлення ${esc(orderNumber)}!</h2>
<p>Вітаємо, ${esc(o.firstName)}! ${paid ? "Оплату отримано, замовлення передано в обробку." : "Ми отримали ваше замовлення, менеджер зв'яжеться з вами для підтвердження."}</p>
<table style="border-collapse:collapse;margin:12px 0">${lines}</table>
<p><b>Разом: ${formatPrice(Number(o.total))} ₴</b> (без вартості доставки)</p>
<p>Доставка: ${esc(CARRIER[String(o.carrier)] ?? o.carrier)}, ${esc(o.city)}, ${esc(o.warehouse)}<br>Оплата: ${esc(PAY[String(o.method)] ?? o.method)}${paid ? " — сплачено" : ""}</p>
<p><a href="${esc(link)}">Переглянути замовлення</a></p>
<p style="color:#666">Питання? ${esc(SITE_NAME)}, ${esc(SHOP_PHONE_TEXT)}</p></div>`;

  return sendMail(String(o.email), `Замовлення ${orderNumber} — ${SITE_NAME}`, html);
}
