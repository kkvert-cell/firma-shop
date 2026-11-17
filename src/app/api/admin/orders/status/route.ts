import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { apiAdminOk } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const STATUSES = ["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const form = await req.formData();
  const number = String(form.get("number") ?? "");
  const status = String(form.get("status") ?? "");
  if (!/^F-\d+$/.test(number) || !STATUSES.includes(status)) return new NextResponse("Bad request", { status: 400 });
  const run = getRunner();
  await run(`UPDATE "Order" SET status = $2::"OrderStatus", "updatedAt" = now() WHERE "orderNumber" = $1`, [number, status]);
  // ТТН (необов'язково): покупець бачить його в кабінеті з посиланням на відстеження; порожнє поле прибирає ТТН
  if (form.has("ttn")) {
    const ttn = String(form.get("ttn") ?? "").replace(/\s+/g, "");
    if (ttn && !/^[0-9A-Za-z]{8,30}$/.test(ttn)) return NextResponse.redirect(new URL(`/admin/orders/${number}?err=ttn`, req.url), 303);
    await run(`UPDATE "Shipment" SET "trackingId" = $2 WHERE "orderId" = (SELECT id FROM "Order" WHERE "orderNumber" = $1)`, [number, ttn || null]);
  }
  return NextResponse.redirect(new URL(`/admin/orders/${number}?ok=status`, req.url), 303);
}
