// Створення замовлень. Головне правило: від клієнта беремо лише ЩО і СКІЛЬКИ (id і кількість) та
// контакти. Ціни, назви й наявність сервер завжди читає з бази сам — підмінити їх з браузера не можна.

import type { Run } from "./catalog";

export type OrderInput = {
  token: string;
  firstName: string;
  lastName: string;
  phone: string; // уже нормалізований: +380XXXXXXXXX
  email: string | null;
  carrier: "NOVA_POSHTA" | "UKRPOSHTA";
  city: string;
  point: string;
  cityRef: string | null; // код города Новой почты (если выбран из списка)
  pointRef: string | null; // код отделения Новой почты
  payment: "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "ONLINE_CARD";
  comment: string | null;
  items: { id: string; qty: number }[];
};

export type Problem = { id: string; name: string; reason: string };
export type OrderResult =
  | { ok: true; orderNumber: string; token: string; total?: number; created?: boolean }
  | { ok: false; status: number; error: string; problems?: Problem[]; fields?: Record<string, string> };

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (/^380\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+38${digits}`;
  return null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validateOrder(body: unknown): { ok: true; value: OrderInput } | { ok: false; fields: Record<string, string> } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const token = str(b.token, 64);
  if (!/^[0-9a-zA-Z-]{16,64}$/.test(token)) fields.token = "Оновіть сторінку й спробуйте ще раз";

  const firstName = str(b.firstName, 60);
  const lastName = str(b.lastName, 60);
  if (firstName.length < 2) fields.firstName = "Вкажіть ім'я";
  if (lastName.length < 2) fields.lastName = "Вкажіть прізвище";

  const phone = normalizePhone(str(b.phone, 30));
  if (!phone) fields.phone = "Вкажіть телефон у форматі 0XX XXX XX XX";

  const emailRaw = str(b.email, 120);
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) fields.email = "Перевірте адресу пошти";

  const carrier = b.carrier === "UKRPOSHTA" ? "UKRPOSHTA" : b.carrier === "NOVA_POSHTA" ? "NOVA_POSHTA" : null;
  if (!carrier) fields.carrier = "Оберіть спосіб доставки";

  const city = str(b.city, 100);
  const point = str(b.point, 200);
  if (city.length < 2) fields.city = "Вкажіть населений пункт";
  if (point.length < 2) fields.point = carrier === "UKRPOSHTA" ? "Вкажіть відділення або адресу" : "Вкажіть відділення, поштомат або адресу";

  const refOk = (v: unknown) => (typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v.trim()) ? v.trim() : null);
  const cityRef = carrier === "NOVA_POSHTA" ? refOk(b.cityRef) : null;
  const pointRef = carrier === "NOVA_POSHTA" && cityRef ? refOk(b.pointRef) : null;

  const payment =
    b.payment === "BANK_TRANSFER" ? "BANK_TRANSFER" : b.payment === "CASH_ON_DELIVERY" ? "CASH_ON_DELIVERY" : b.payment === "ONLINE_CARD" ? "ONLINE_CARD" : null;
  if (!payment) fields.payment = "Оберіть спосіб оплати";

  const itemsRaw = Array.isArray(b.items) ? b.items : [];
  const merged = new Map<string, number>();
  for (const it of itemsRaw.slice(0, 60)) {
    const rec = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
    const id = str(rec.id, 64);
    const qty = Math.floor(Number(rec.qty));
    if (!/^[0-9a-zA-Z-]{6,64}$/.test(id) || !Number.isFinite(qty) || qty < 1) continue;
    merged.set(id, Math.min(99, (merged.get(id) ?? 0) + qty));
  }
  if (merged.size === 0) fields.items = "Кошик порожній";

  if (Object.keys(fields).length) return { ok: false, fields };
  return {
    ok: true,
    value: {
      token,
      firstName,
      lastName,
      phone: phone!,
      email: emailRaw || null,
      carrier: carrier!,
      city,
      point,
      cityRef,
      pointRef,
      payment: payment!,
      comment: str(b.comment, 1000) || null,
      items: [...merged.entries()].map(([id, qty]) => ({ id, qty })),
    },
  };
}

export async function createOrder(run: Run, input: OrderInput): Promise<OrderResult> {
  // Повторна відправка тієї самої форми — повертаємо вже створене замовлення
  const dup = await run(`SELECT "orderNumber" FROM "Order" WHERE "clientToken" = $1`, [input.token]);
  if (dup[0]) return { ok: true, orderNumber: String(dup[0].orderNumber), token: input.token };

  // Захист від спаму: не більше 3 замовлень з одного телефону за 10 хвилин
  const recent = await run(
    `SELECT count(*)::int AS n FROM "Order" WHERE phone = $1 AND "createdAt" > now() - interval '10 minutes'`,
    [input.phone]
  );
  if (Number(recent[0]?.n ?? 0) >= 3) {
    return { ok: false, status: 429, error: "Забагато замовлень за короткий час. Спробуйте за кілька хвилин або зателефонуйте нам." };
  }

  const found = await run(
    `SELECT id, name, price::float8 AS price, "isAvailable", "stockQty", ("stockSyncedAt" IS NOT NULL) AS exact, "vendorCode"
     FROM "Product" WHERE id = ANY($1::text[]) AND "isHidden" = false`,
    [input.items.map((i) => i.id)]
  );
  const byId = new Map(found.map((r) => [String(r.id), r]));

  const problems: Problem[] = [];
  const lines: { productId: string; qty: number; price: number; name: string; vendorCode: string | null }[] = [];
  for (const it of input.items) {
    const p = byId.get(it.id);
    if (!p) {
      problems.push({ id: it.id, name: "Товар", reason: "більше не продається" });
      continue;
    }
    const name = String(p.name);
    const price = Number(p.price);
    if (!p.isAvailable) problems.push({ id: it.id, name, reason: "немає в наявності" });
    else if (!(price > 0)) problems.push({ id: it.id, name, reason: "ціну уточнюйте за телефоном" });
    else if (p.exact && it.qty > Number(p.stockQty)) problems.push({ id: it.id, name, reason: `доступно лише ${p.stockQty} шт.` });
    else lines.push({ productId: it.id, qty: it.qty, price, name, vendorCode: p.vendorCode ? String(p.vendorCode) : null });
  }
  if (problems.length) {
    return { ok: false, status: 409, error: "Деякі товари змінилися. Перевірте кошик.", problems };
  }

  const total = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;

  // Усе одним запитом: замовлення, товари, доставка й оплата зберігаються разом або не зберігаються взагалі
  try {
    const res = await run(
      `WITH o AS (
         INSERT INTO "Order"("orderNumber", "clientToken", "firstName", "lastName", phone, email, "totalAmount", comment)
         VALUES ('F-' || nextval('"OrderNumberSeq"'), $1, $2, $3, $4, $5, $6, $7)
         RETURNING id, "orderNumber"),
       i AS (
         INSERT INTO "OrderItem"("orderId", "productId", quantity, price, name, "vendorCode")
         SELECT o.id, x."productId", x.qty, x.price, x.name, x."vendorCode"
         FROM o, jsonb_to_recordset($8::jsonb) AS x("productId" text, qty int, price numeric, name text, "vendorCode" text)
         RETURNING 1),
       s AS (
         INSERT INTO "Shipment"("orderId", carrier, city, warehouse)
         SELECT o.id, $9::"ShipmentCarrier", $10, $11 FROM o
         RETURNING 1),
       p AS (
         INSERT INTO "Payment"("orderId", method)
         SELECT o.id, $12::"PaymentMethod" FROM o
         RETURNING 1)
       SELECT "orderNumber" FROM o`,
      [
        input.token, input.firstName, input.lastName, input.phone, input.email, total, input.comment,
        JSON.stringify(lines), input.carrier, input.city, input.point, input.payment,
      ]
    );
    const orderNumber = String(res[0].orderNumber);
    if (input.cityRef && input.pointRef) {
      // Коди НП пишемо окремо: якщо міграцію 006 ще не виконано, замовлення від цього не постраждає
      try {
        await run(
          `UPDATE "Shipment" SET "cityRef" = $2, "warehouseRef" = $3 WHERE "orderId" = (SELECT id FROM "Order" WHERE "orderNumber" = $1)`,
          [orderNumber, input.cityRef, input.pointRef]
        );
      } catch (e) {
        console.error("shipment refs:", e);
      }
    }
    return { ok: true, orderNumber, token: input.token, total, created: true };
  } catch (err) {
    // Гонка: та сама форма відправлена двічі одночасно — друга впирається в унікальний токен
    const again = await run(`SELECT "orderNumber" FROM "Order" WHERE "clientToken" = $1`, [input.token]);
    if (again[0]) return { ok: true, orderNumber: String(again[0].orderNumber), token: input.token };
    throw err;
  }
}
