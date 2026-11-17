import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { customerFromRequest } from "@/lib/customer-auth";
import { getPrefill } from "@/lib/customer-data";

export const dynamic = "force-dynamic";

// Дані для автозаповнення форми оформлення (лише для авторизованого покупця): профіль, збережена адреса або останнє замовлення
export async function GET(req: NextRequest) {
  const email = customerFromRequest(req);
  if (!email) return NextResponse.json({});
  try {
    return NextResponse.json(await getPrefill(getRunner(), email));
  } catch {
    return NextResponse.json({});
  }
}
