import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { customerFromRequest } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// Дані останнього замовлення для автозаповнення форми оформлення (лише для авторизованого покупця)
export async function GET(req: NextRequest) {
  const email = customerFromRequest(req);
  if (!email) return NextResponse.json({});
  const rows = await getRunner()(
    `SELECT o."firstName", o."lastName", o.phone, o.email, s.carrier::text AS carrier, s.city, s.warehouse AS point,
            to_jsonb(s) ->> 'cityRef' AS "cityRef", to_jsonb(s) ->> 'warehouseRef' AS "pointRef"
     FROM "Order" o LEFT JOIN "Shipment" s ON s."orderId" = o.id
     WHERE lower(o.email) = $1 ORDER BY o."createdAt" DESC LIMIT 1`,
    [email]
  );
  return NextResponse.json(rows[0] ?? {});
}
