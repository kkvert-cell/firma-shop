// Онлайн-оплата карткою: LiqPay або WayForPay. Працює, лише якщо в Cloudflare додано секрети
// відповідного сервісу; без них кнопка «Картка онлайн» на сайті не показується.
//   LiqPay:     LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY   (LIQPAY_SANDBOX=1 — тестові платежі)
//   WayForPay:  WAYFORPAY_MERCHANT, WAYFORPAY_SECRET
//   PAYMENT_PROVIDER=liqpay|wayforpay — потрібен лише якщо додано секрети обох сервісів.
// Тільки відносні імпорти, окрім node:crypto.

import { createHash, createHmac } from "node:crypto";
import type { Run } from "./catalog";

export type Provider = "liqpay" | "wayforpay";

const env = (n: string) => (process.env[n] ?? "").trim();

export function activeProvider(): Provider | null {
  const lp = !!(env("LIQPAY_PUBLIC_KEY") && env("LIQPAY_PRIVATE_KEY"));
  const wf = !!(env("WAYFORPAY_MERCHANT") && env("WAYFORPAY_SECRET"));
  const want = env("PAYMENT_PROVIDER").toLowerCase();
  if (want === "wayforpay" && wf) return "wayforpay";
  if (want === "liqpay" && lp) return "liqpay";
  if (lp) return "liqpay";
  if (wf) return "wayforpay";
  return null;
}

// сума однаково записується і в підписі, і в формі
const money = (n: number) => String(Math.round(n * 100) / 100);

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

export function liqpaySign(dataB64: string, privateKey: string): string {
  return createHash("sha1").update(privateKey + dataB64 + privateKey).digest("base64");
}

export function wfpSign(parts: (string | number)[], secret: string): string {
  return createHmac("md5", secret).update(parts.join(";")).digest("hex");
}

export type PayForm = { provider: Provider; action: string; fields: [string, string][]; reference: string };

export type PayInput = {
  orderNumber: string;
  token: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
  siteUrl: string;
};

export function buildPayForm(p: PayInput, provider: Provider | null = activeProvider(), nowMs = Date.now()): PayForm | null {
  if (!provider) return null;
  // кожна спроба оплати — окремий номер, щоб після невдачі можна було заплатити ще раз
  const reference = `${p.orderNumber}_${Math.floor(nowMs / 1000).toString(36)}`;
  const resultUrl = `${p.siteUrl}/api/payment/return?o=${encodeURIComponent(p.orderNumber)}&t=${encodeURIComponent(p.token)}`;
  const amount = money(p.total);

  if (provider === "liqpay") {
    const data: Record<string, unknown> = {
      public_key: env("LIQPAY_PUBLIC_KEY"),
      version: 3,
      action: "pay",
      amount: Number(amount),
      currency: "UAH",
      description: `Замовлення ${p.orderNumber}`,
      order_id: reference,
      language: "uk",
      result_url: resultUrl,
      server_url: `${p.siteUrl}/api/payment/liqpay`,
    };
    if (env("LIQPAY_SANDBOX") === "1") data.sandbox = 1;
    const dataB64 = b64(JSON.stringify(data));
    return {
      provider,
      reference,
      action: "https://www.liqpay.ua/api/3/checkout",
      fields: [["data", dataB64], ["signature", liqpaySign(dataB64, env("LIQPAY_PRIVATE_KEY"))]],
    };
  }

  const merchant = env("WAYFORPAY_MERCHANT");
  const domain = new URL(p.siteUrl).host;
  const date = Math.floor(nowMs / 1000);
  const names = p.items.map((i) => i.name.replace(/;/g, ",").slice(0, 120));
  const counts = p.items.map((i) => String(i.qty));
  const prices = p.items.map((i) => money(i.price));
  const signature = wfpSign([merchant, domain, reference, date, amount, "UAH", ...names, ...counts, ...prices], env("WAYFORPAY_SECRET"));
  const fields: [string, string][] = [
    ["merchantAccount", merchant],
    ["merchantAuthType", "SimpleSignature"],
    ["merchantDomainName", domain],
    ["merchantSignature", signature],
    ["orderReference", reference],
    ["orderDate", String(date)],
    ["amount", amount],
    ["currency", "UAH"],
    ["language", "UA"],
    ["returnUrl", resultUrl],
    ["serviceUrl", `${p.siteUrl}/api/payment/wayforpay`],
  ];
  names.forEach((n) => fields.push(["productName[]", n]));
  counts.forEach((c) => fields.push(["productCount[]", c]));
  prices.forEach((x) => fields.push(["productPrice[]", x]));
  return { provider, reference, action: "https://secure.wayforpay.com/pay", fields };
}

// ---------- Перевірка повідомлень від сервісів ----------

export type PaymentEvent = { orderNumber: string; status: "PAID" | "FAILED" | "REFUNDED" | "IGNORE"; amount: number; currency: string; providerRef: string };

const orderFromRef = (ref: unknown): string | null => {
  const m = /^(F-\d+)(?:_[0-9a-z]+)?$/.exec(String(ref ?? ""));
  return m ? m[1] : null;
};

const safeEq = (a: string, b: string) => a.length === b.length && createHash("sha256").update(a).digest("hex") === createHash("sha256").update(b).digest("hex");

export function parseLiqpayCallback(dataB64: string, signature: string): PaymentEvent | null {
  const priv = env("LIQPAY_PRIVATE_KEY");
  if (!priv || !dataB64 || !signature || !safeEq(liqpaySign(dataB64, priv), signature)) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(Buffer.from(dataB64, "base64").toString("utf8"));
  } catch {
    return null;
  }
  const orderNumber = orderFromRef(d.order_id);
  if (!orderNumber) return null;
  const st = String(d.status ?? "");
  const sandbox = env("LIQPAY_SANDBOX") === "1";
  let status: PaymentEvent["status"] = "IGNORE";
  if (st === "success" || (st === "sandbox" && sandbox)) status = "PAID";
  else if (st === "failure" || st === "error") status = "FAILED";
  else if (st === "reversed") status = "REFUNDED";
  return { orderNumber, status, amount: Number(d.amount), currency: String(d.currency ?? ""), providerRef: String(d.payment_id ?? d.transaction_id ?? "") };
}

export function parseWayforpayCallback(body: Record<string, unknown>): PaymentEvent | null {
  const secret = env("WAYFORPAY_SECRET");
  const merchant = env("WAYFORPAY_MERCHANT");
  if (!secret || String(body.merchantAccount ?? "") !== merchant) return null;
  const expected = wfpSign(
    [body.merchantAccount, body.orderReference, body.amount, body.currency, body.authCode, body.cardPan, body.transactionStatus, body.reasonCode].map((v) => String(v ?? "")),
    secret
  );
  if (!safeEq(expected, String(body.merchantSignature ?? ""))) return null;
  const orderNumber = orderFromRef(body.orderReference);
  if (!orderNumber) return null;
  const st = String(body.transactionStatus ?? "");
  const status: PaymentEvent["status"] = st === "Approved" ? "PAID" : st === "Declined" || st === "Expired" ? "FAILED" : st === "Refunded" ? "REFUNDED" : "IGNORE";
  return { orderNumber, status, amount: Number(body.amount), currency: String(body.currency ?? ""), providerRef: String(body.authCode ?? body.orderReference ?? "") };
}

// Відповідь, якої чекає WayForPay (інакше він повторює повідомлення)
export function wfpAccept(orderReference: string) {
  const time = Math.floor(Date.now() / 1000);
  return { orderReference, status: "accept", time, signature: wfpSign([orderReference, "accept", time], env("WAYFORPAY_SECRET")) };
}

// ---------- Запис результату в базу ----------

export type Applied = { changed: boolean; reason?: string; orderNumber: string; total?: number };

export async function applyPayment(run: Run, ev: PaymentEvent): Promise<Applied> {
  if (ev.status === "IGNORE") return { changed: false, reason: "проміжний статус", orderNumber: ev.orderNumber };
  const rows = await run(
    `SELECT o."totalAmount"::float8 AS total, p.status::text AS status, p.method::text AS method
     FROM "Order" o JOIN "Payment" p ON p."orderId" = o.id WHERE o."orderNumber" = $1`,
    [ev.orderNumber]
  );
  const cur = rows[0];
  if (!cur || cur.method !== "ONLINE_CARD") return { changed: false, reason: "замовлення не для онлайн-оплати", orderNumber: ev.orderNumber };
  const total = Number(cur.total);
  if (ev.status === "PAID" && (ev.currency !== "UAH" || Math.abs(ev.amount - total) > 0.01)) {
    return { changed: false, reason: `сума не збігається (${ev.amount} ${ev.currency}, очікували ${total} UAH)`, orderNumber: ev.orderNumber, total };
  }
  const from = String(cur.status);
  const allowed = ev.status === "REFUNDED" ? from === "PAID" : from !== "PAID" && from !== ev.status;
  if (!allowed) return { changed: false, reason: "без змін", orderNumber: ev.orderNumber, total };
  await run(
    `UPDATE "Payment" SET status = $2::"PaymentStatus", "providerRef" = $3,
            "paidAt" = CASE WHEN $2 = 'PAID' THEN now() ELSE "paidAt" END
     WHERE "orderId" = (SELECT id FROM "Order" WHERE "orderNumber" = $1)`,
    [ev.orderNumber, ev.status, ev.providerRef || null]
  );
  return { changed: true, orderNumber: ev.orderNumber, total };
}
