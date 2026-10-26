// Передача замовлень із сайту в KeyCRM (POST /order).
// Принципи:
//  • замовлення вже збережене в нашій базі — збій KeyCRM його не губить, ми просто повторюємо спробу;
//  • перед створенням перевіряємо, чи KeyCRM уже не має цього замовлення (щоб не було дублів);
//  • після кількох невдач повідомляємо власницю в Telegram (якщо налаштовано).
// Тільки відносні імпорти: файл використовується і в cron-воркері.

import type { Run } from "./catalog";
import { keycrmGet, keycrmPost } from "./keycrm";
import { notifyOwner } from "./notify";

export const MAX_ATTEMPTS = 6; // після 6 невдач перестаємо пробувати самі
export const WARN_AT_ATTEMPT = 3; // і вже на 3-й невдачі попереджаємо власницю

// Служби доставки в KeyCRM (з налаштувань джерела «firmashop-prom»): Нова пошта — 4, Укрпошта — 5.
// За потреби перевизначаються секретами KEYCRM_DELIVERY_NP / KEYCRM_DELIVERY_UKR.
const envNum = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  comment: string | null;
  keycrmOrderId: string | null;
  keycrmAttempts: number;
  carrier: string | null;
  city: string | null;
  warehouse: string | null;
  method: string | null;
  warehouseRef: string | null;
  payStatus: string | null;
  total: number;
};
type ItemRow = { name: string | null; vendorCode: string | null; quantity: number; price: number };

const CARRIER_NAME: Record<string, string> = { NOVA_POSHTA: "Нова Пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };
const PAY_NOTE: Record<string, string> = {
  CASH_ON_DELIVERY: "накладений платіж (оплата при отриманні)",
  BANK_TRANSFER: "за реквізитами — потрібно надіслати клієнту рахунок",
  ONLINE_CARD: "картка онлайн",
};

export function buildKeycrmOrder(o: OrderRow, items: ItemRow[], sourceId: number) {
  const paidOnline = o.method === "ONLINE_CARD" && o.payStatus === "PAID";
  // id способу оплати в KeyCRM (необов'язково). Якщо задати секрет KEYCRM_PAYMENT_METHOD_ID, оплата піде в KeyCRM як «сплачено»
  const payMethodId = Number(process.env.KEYCRM_PAYMENT_METHOD_ID);
  const carrierName = CARRIER_NAME[o.carrier ?? ""] ?? "Інше";
  const delivery =
    o.carrier === "NOVA_POSHTA"
      ? envNum("KEYCRM_DELIVERY_NP", 4)
      : o.carrier === "UKRPOSHTA"
      ? envNum("KEYCRM_DELIVERY_UKR", 5)
      : null;
  const fullName = `${o.lastName} ${o.firstName}`.trim();

  return {
    source_id: sourceId,
    source_uuid: o.orderNumber, // наш номер: за ним же шукаємо дублі
    manager_comment: `Замовлення з сайту ${o.orderNumber}. Оплата: ${paidOnline ? "картка онлайн — СПЛАЧЕНО, гроші вже отримано" : PAY_NOTE[o.method ?? ""] ?? "уточнити"}.`,
    buyer_comment: o.comment ?? undefined,
    buyer: { full_name: fullName, phone: o.phone, ...(o.email ? { email: o.email } : {}) },
    shipping: {
      ...(delivery ? { delivery_service_id: delivery } : {}),
      shipping_service: carrierName,
      shipping_address_city: o.city ?? "",
      shipping_receive_point: o.warehouse ?? "",
      ...(o.warehouseRef ? { warehouse_ref: o.warehouseRef } : {}),
      recipient_full_name: fullName,
      recipient_phone: o.phone,
    },
    ...(paidOnline && Number.isFinite(payMethodId) && payMethodId > 0
      ? { payments: [{ payment_method_id: payMethodId, amount: o.total, status: "paid", description: `Онлайн-оплата ${o.orderNumber}` }] }
      : {}),
    products: items.map((i) => ({
      ...(i.vendorCode ? { sku: i.vendorCode } : {}),
      name: i.name ?? "Товар",
      price: i.price,
      quantity: i.quantity,
    })),
  };
}

const short = (v: unknown) => {
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return (t ?? "").slice(0, 400);
};

// Шукає джерело «сайт»: спочатку секрет KEYCRM_SOURCE_ID, потім — серед джерел KeyCRM
// те, що не є Prom/Rozetka/Kasta і має в назві «сайт», «site» або «firma-shop».
export async function resolveSourceId(): Promise<number> {
  const fixed = Number(process.env.KEYCRM_SOURCE_ID);
  if (Number.isFinite(fixed) && fixed > 0) return fixed;

  const r = await keycrmGet("/order/source", { limit: 50 });
  if (!r.ok) throw new Error(`KeyCRM не віддав список джерел (${r.status})`);
  const list = ((r.body as { data?: unknown })?.data ?? []) as Record<string, unknown>[];
  const marketplaces = new Set(["promua", "rozetka", "kasta", "epicentrk", "olx"]);
  const hit = list.find((s) => {
    const text = `${s.name ?? ""} ${s.alias ?? ""}`.toLowerCase();
    return !marketplaces.has(String(s.driver ?? "").toLowerCase()) && /сайт|site|firma-?shop|web/.test(text);
  });
  if (!hit) {
    throw new Error("У KeyCRM немає джерела «Сайт». Створіть його (Налаштування → Джерела замовлень → Додати) з назвою «Сайт Firma».");
  }
  return Number(hit.id);
}

// Чи вже є в KeyCRM замовлення з цим номером (на випадок, коли відповідь на створення загубилась)
async function findExisting(sourceId: number, orderNumber: string): Promise<string | null> {
  const r = await keycrmGet("/order", { limit: 1, "filter[source_id]": sourceId, "filter[source_uuid]": orderNumber });
  if (!r.ok) return null;
  const first = ((r.body as { data?: unknown })?.data as Record<string, unknown>[] | undefined)?.[0];
  return first && String(first.source_uuid ?? "") === orderNumber && first.id != null ? String(first.id) : null;
}

export type SendResult = { ok: true; keycrmId: string; already?: boolean } | { ok: false; error: string; attempts: number; waiting?: boolean };

export async function sendOrderToKeycrm(run: Run, orderNumber: string): Promise<SendResult> {
  const rows = (await run(
    `SELECT o.id, o."orderNumber", o."firstName", o."lastName", o.phone, o.email, o.comment,
            o."keycrmOrderId", o."keycrmAttempts", s.carrier::text AS carrier, s.city, s.warehouse, p.method::text AS method,
            to_jsonb(s) ->> 'warehouseRef' AS "warehouseRef",
            p.status::text AS "payStatus", o."totalAmount"::float8 AS total
     FROM "Order" o
     LEFT JOIN "Shipment" s ON s."orderId" = o.id
     LEFT JOIN "Payment" p ON p."orderId" = o.id
     WHERE o."orderNumber" = $1`,
    [orderNumber]
  )) as unknown as OrderRow[];
  const o = rows[0];
  if (!o) return { ok: false, error: "Замовлення не знайдено", attempts: 0 };
  if (o.keycrmOrderId) return { ok: true, keycrmId: o.keycrmOrderId, already: true };
  // Онлайн-оплата ще не завершена — замовлення поки не передаємо (передамо одразу після оплати)
  if (o.method === "ONLINE_CARD" && o.payStatus !== "PAID") {
    return { ok: false, error: "Очікує онлайн-оплати", attempts: Number(o.keycrmAttempts), waiting: true };
  }

  const attempts = Number(o.keycrmAttempts) + 1;
  try {
    const items = (await run(
      `SELECT name, "vendorCode", quantity, price::float8 AS price FROM "OrderItem" WHERE "orderId" = $1 ORDER BY name`,
      [o.id]
    )) as unknown as ItemRow[];
    if (!items.length) throw new Error("У замовленні немає товарів");

    const sourceId = await resolveSourceId();
    let keycrmId = await findExisting(sourceId, o.orderNumber);
    if (!keycrmId) {
      const r = await keycrmPost("/order", buildKeycrmOrder(o, items, sourceId));
      const id = (r.body as { id?: unknown } | null)?.id;
      if (!r.ok || id == null) throw new Error(`KeyCRM відповів ${r.status}: ${short(r.body)}`);
      keycrmId = String(id);
    }
    await run(
      `UPDATE "Order" SET "keycrmOrderId" = $2, "keycrmSyncedAt" = now(), "keycrmError" = NULL,
              "keycrmAttempts" = $3, "keycrmTriedAt" = now() WHERE id = $1`,
      [o.id, keycrmId, attempts]
    );
    return { ok: true, keycrmId };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await run(
      `UPDATE "Order" SET "keycrmError" = $2, "keycrmAttempts" = $3, "keycrmTriedAt" = now() WHERE id = $1`,
      [o.id, msg, attempts]
    );
    if (attempts === WARN_AT_ATTEMPT || attempts === MAX_ATTEMPTS) {
      await notifyOwner(
        attempts === MAX_ATTEMPTS
          ? `⚠️ Замовлення ${o.orderNumber} (${o.lastName} ${o.firstName}, ${o.phone}) НЕ потрапило в KeyCRM. Автоматичні спроби закінчились — внесіть його вручну.\nПричина: ${msg}`
          : `⚠️ Замовлення ${o.orderNumber} (${o.lastName} ${o.firstName}, ${o.phone}) поки не передалось у KeyCRM. Ми пробуємо ще.\nПричина: ${msg}`
      );
    }
    return { ok: false, error: msg, attempts };
  }
}

// Для cron: добирає замовлення, які ще не в KeyCRM (з паузою, що росте після кожної невдачі).
export async function retryPendingOrders(run: Run, maxOrders: number): Promise<{ tried: number; sent: number }> {
  const due = await run(
    `SELECT o."orderNumber" FROM "Order" o
     WHERE o."keycrmOrderId" IS NULL AND o."keycrmAttempts" < $1
       AND COALESCE(o."keycrmTriedAt", o."createdAt") < now() - (interval '5 minutes' * GREATEST(o."keycrmAttempts", 1))
       AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o.id AND p.method = 'ONLINE_CARD' AND p.status <> 'PAID')
     ORDER BY o."createdAt" LIMIT $2`,
    [MAX_ATTEMPTS, maxOrders]
  );
  let sent = 0;
  for (const row of due) {
    const r = await sendOrderToKeycrm(run, String(row.orderNumber));
    if (r.ok) sent++;
  }
  return { tried: due.length, sent };
}
