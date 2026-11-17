// Дані особистого кабінету: профіль покупця й збережені адреси доставки.
// Таблиці створюються автоматично при першому зверненні (sql/migration-011-customer.sql робить те саме вручну).

import type { Run } from "./catalog";
import { normalizePhone } from "./orders";

export type Profile = { firstName: string; lastName: string; phone: string };
export type Address = { id: string; carrier: "NOVA_POSHTA" | "UKRPOSHTA"; city: string; cityRef: string; warehouse: string; warehouseRef: string; isDefault: boolean };

let ready: Promise<void> | null = null;

export function ensureCustomerTables(run: Run): Promise<void> {
  ready ??= (async () => {
    await run(`CREATE TABLE IF NOT EXISTS "Customer" (email TEXT PRIMARY KEY, "firstName" TEXT NOT NULL DEFAULT '', "lastName" TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`, []);
    await run(
      `CREATE TABLE IF NOT EXISTS "CustomerAddress" (id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, carrier TEXT NOT NULL, city TEXT NOT NULL, "cityRef" TEXT, warehouse TEXT NOT NULL, "warehouseRef" TEXT, "isDefault" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now())`,
      []
    );
    await run(`CREATE INDEX IF NOT EXISTS "CustomerAddress_email_idx" ON "CustomerAddress" (email)`, []);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

const s = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function getProfile(run: Run, email: string): Promise<Profile> {
  await ensureCustomerTables(run);
  const r = await run(`SELECT "firstName", "lastName", phone FROM "Customer" WHERE email = $1`, [email]);
  return { firstName: String(r[0]?.firstName ?? ""), lastName: String(r[0]?.lastName ?? ""), phone: String(r[0]?.phone ?? "") };
}

// Повертає текст помилки або null, якщо збережено
export async function saveProfile(run: Run, email: string, input: { firstName: unknown; lastName: unknown; phone: unknown }): Promise<string | null> {
  const firstName = s(input.firstName, 60);
  const lastName = s(input.lastName, 60);
  const rawPhone = s(input.phone, 30);
  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  if (rawPhone && !phone) return "Вкажіть телефон у форматі 0XX XXX XX XX";
  await ensureCustomerTables(run);
  await run(
    `INSERT INTO "Customer"(email, "firstName", "lastName", phone) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET "firstName" = $2, "lastName" = $3, phone = $4, "updatedAt" = now()`,
    [email, firstName, lastName, phone ?? ""]
  );
  return null;
}

export async function listAddresses(run: Run, email: string): Promise<Address[]> {
  await ensureCustomerTables(run);
  const r = await run(
    `SELECT id::text AS id, carrier, city, COALESCE("cityRef", '') AS "cityRef", warehouse, COALESCE("warehouseRef", '') AS "warehouseRef", "isDefault"
       FROM "CustomerAddress" WHERE email = $1 ORDER BY "isDefault" DESC, id DESC LIMIT 20`,
    [email]
  );
  return r.map((x) => ({
    id: String(x.id),
    carrier: x.carrier === "UKRPOSHTA" ? "UKRPOSHTA" : "NOVA_POSHTA",
    city: String(x.city),
    cityRef: String(x.cityRef),
    warehouse: String(x.warehouse),
    warehouseRef: String(x.warehouseRef),
    isDefault: !!x.isDefault,
  }));
}

export async function addAddress(run: Run, email: string, a: { carrier: unknown; city: unknown; cityRef: unknown; warehouse: unknown; warehouseRef: unknown }): Promise<string | null> {
  const carrier = a.carrier === "UKRPOSHTA" ? "UKRPOSHTA" : "NOVA_POSHTA";
  const city = s(a.city, 120);
  const warehouse = s(a.warehouse, 200);
  if (!city || !warehouse) return carrier === "UKRPOSHTA" ? "Вкажіть місто та відділення (індекс)" : "Оберіть місто й відділення";
  await ensureCustomerTables(run);
  const have = await run(`SELECT count(*)::int AS n FROM "CustomerAddress" WHERE email = $1`, [email]);
  const n = Number(have[0]?.n ?? 0);
  if (n >= 10) return "Можна зберегти не більше 10 адрес";
  const dup = await run(`SELECT 1 AS x FROM "CustomerAddress" WHERE email = $1 AND carrier = $2 AND city = $3 AND warehouse = $4`, [email, carrier, city, warehouse]);
  if (dup.length) return "Така адреса вже збережена";
  await run(
    `INSERT INTO "CustomerAddress"(email, carrier, city, "cityRef", warehouse, "warehouseRef", "isDefault") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [email, carrier, city, s(a.cityRef, 80) || null, warehouse, s(a.warehouseRef, 80) || null, n === 0]
  );
  return null;
}

export async function deleteAddress(run: Run, email: string, id: unknown): Promise<void> {
  if (!/^\d{1,18}$/.test(String(id))) return;
  await ensureCustomerTables(run);
  await run(`DELETE FROM "CustomerAddress" WHERE email = $1 AND id = $2::bigint`, [email, String(id)]);
  // якщо видалили основну — найновіша з решти стає основною
  await run(
    `UPDATE "CustomerAddress" SET "isDefault" = true WHERE id = (SELECT id FROM "CustomerAddress" WHERE email = $1 ORDER BY id DESC LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM "CustomerAddress" WHERE email = $1 AND "isDefault")`,
    [email]
  );
}

export async function setDefaultAddress(run: Run, email: string, id: unknown): Promise<void> {
  if (!/^\d{1,18}$/.test(String(id))) return;
  await ensureCustomerTables(run);
  await run(`UPDATE "CustomerAddress" SET "isDefault" = (id = $2::bigint) WHERE email = $1`, [email, String(id)]);
}

// Видалення профілю й збережених адрес. Замовлення лишаються (потрібні для обліку й гарантії).
export async function deleteMyData(run: Run, email: string): Promise<void> {
  await ensureCustomerTables(run);
  await run(`DELETE FROM "CustomerAddress" WHERE email = $1`, [email]);
  await run(`DELETE FROM "Customer" WHERE email = $1`, [email]);
}

// Дані для автозаповнення оформлення: профіль → основна збережена адреса → останнє замовлення
export async function getPrefill(run: Run, email: string): Promise<Record<string, unknown>> {
  const last = (
    await run(
      `SELECT o."firstName", o."lastName", o.phone, o.email, s.carrier::text AS carrier, s.city, s.warehouse AS point,
              to_jsonb(s) ->> 'cityRef' AS "cityRef", to_jsonb(s) ->> 'warehouseRef' AS "pointRef"
       FROM "Order" o LEFT JOIN "Shipment" s ON s."orderId" = o.id
       WHERE lower(o.email) = $1 ORDER BY o."createdAt" DESC LIMIT 1`,
      [email]
    )
  )[0] ?? {};
  let profile: Profile = { firstName: "", lastName: "", phone: "" };
  let addr: Address | undefined;
  try {
    profile = await getProfile(run, email);
    addr = (await listAddresses(run, email)).find((a) => a.isDefault);
  } catch {
    // таблиці кабінету недоступні — користуємося останнім замовленням
  }
  const base: Record<string, unknown> = {
    firstName: profile.firstName || last.firstName || "",
    lastName: profile.firstName ? profile.lastName : last.lastName || "",
    phone: profile.phone || last.phone || "",
    email: last.email || email,
  };
  if (addr) return { ...base, carrier: addr.carrier, city: addr.city, cityRef: addr.cityRef, point: addr.warehouse, pointRef: addr.warehouseRef };
  return { ...base, carrier: last.carrier, city: last.city, cityRef: last.cityRef, point: last.point, pointRef: last.pointRef };
}
