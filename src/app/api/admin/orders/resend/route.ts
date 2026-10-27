import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { apiAdminOk } from "@/lib/admin-auth";
import { sendOrderToKeycrm } from "@/lib/keycrm-orders";

export const dynamic = "force-dynamic";

// Повторна передача замовлення в KeyCRM (скидає лічильник спроб і пробує одразу)
export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const number = String((await req.formData()).get("number") ?? "");
  if (!/^F-\d+$/.test(number)) return new NextResponse("Bad request", { status: 400 });
  const run = getRunner();
  await run(`UPDATE "Order" SET "keycrmAttempts" = 0 WHERE "orderNumber" = $1 AND "keycrmOrderId" IS NULL`, [number]);
  const r = await sendOrderToKeycrm(run, number);
  const q = r.ok ? "ok=keycrm" : `err=${encodeURIComponent(r.error.slice(0, 200))}`;
  return NextResponse.redirect(new URL(`/admin/orders/${number}?${q}`, req.url), 303);
}
