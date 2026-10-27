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
  await getRunner()(`UPDATE "Order" SET status = $2::"OrderStatus", "updatedAt" = now() WHERE "orderNumber" = $1`, [number, status]);
  return NextResponse.redirect(new URL(`/admin/orders/${number}?ok=status`, req.url), 303);
}
