// Лист покупцю «Замовлення відправлено» з ТТН і посиланням на відстеження. Без пошти (Resend) або без e-mail у замовленні нічого не робить.
import type { Run } from "./catalog";
import { sendMail } from "./mail";
import { SHOP_PHONE_TEXT, SITE_NAME, SITE_URL } from "./site";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const TRACK: Record<string, (n: string) => string> = {
  NOVA_POSHTA: (n) => `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(n)}`,
  UKRPOSHTA: (n) => `https://track.ukrposhta.ua/tracking_UA.html?barcode=${encodeURIComponent(n)}`,
};
const CARRIER: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };

export async function sendShippedEmail(run: Run, orderNumber: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return false;
  const rows = await run(
    `SELECT o.email, o."firstName", o."clientToken" AS token, s.carrier::text AS carrier, s.city, s.warehouse, s."trackingId" AS ttn
     FROM "Order" o LEFT JOIN "Shipment" s ON s."orderId" = o.id WHERE o."orderNumber" = $1`,
    [orderNumber]
  );
  const o = rows[0];
  if (!o || !o.email) return false;
  const ttn = o.ttn ? String(o.ttn) : "";
  const track = ttn && TRACK[String(o.carrier)] ? TRACK[String(o.carrier)](ttn) : "";
  const link = `${SITE_URL}/order/${orderNumber}?t=${encodeURIComponent(String(o.token))}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">
<h2 style="margin:0 0 12px;color:#133249">Замовлення ${esc(orderNumber)} відправлено</h2>
<p>Вітаємо, ${esc(o.firstName)}! Ваше замовлення передано перевізнику.</p>
<p>Доставка: ${esc(CARRIER[String(o.carrier)] ?? o.carrier)}, ${esc(o.city)}, ${esc(o.warehouse)}${ttn ? `<br>ТТН: <b>${esc(ttn)}</b>` : ""}</p>
${track ? `<p><a href="${esc(track)}" style="display:inline-block;padding:10px 18px;background:#133249;color:#fff;text-decoration:none;border-radius:6px">Відстежити посилку</a></p>` : ""}
<p><a href="${esc(link)}">Переглянути замовлення</a></p>
<p style="color:#666">Питання? ${esc(SITE_NAME)}, ${esc(SHOP_PHONE_TEXT)}</p></div>`;
  return sendMail(String(o.email), `Замовлення ${orderNumber} відправлено — ${SITE_NAME}`, html);
}
