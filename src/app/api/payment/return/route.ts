// Сюди платіжний сервіс повертає покупця після оплати (іноді методом POST) — переправляємо на сторінку замовлення.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function back(req: NextRequest) {
  const o = req.nextUrl.searchParams.get("o") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!/^F-\d+$/.test(o) || !/^[0-9a-zA-Z-]{16,64}$/.test(t)) return NextResponse.redirect(new URL("/", req.url), 303);
  return NextResponse.redirect(new URL(`/order/${o}?t=${encodeURIComponent(t)}`, req.url), 303);
}

export const GET = back;
export const POST = back;
