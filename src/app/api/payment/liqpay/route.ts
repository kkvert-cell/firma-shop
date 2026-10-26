import { NextRequest, NextResponse } from "next/server";
import { handlePaymentEvent } from "@/lib/payment-events";
import { parseLiqpayCallback } from "@/lib/payments";

export const dynamic = "force-dynamic";

// LiqPay надсилає сюди підписане повідомлення (server_url). Підпис перевіряємо — без нього нічого не змінюємо.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const ev = parseLiqpayCallback(String(form?.get("data") ?? ""), String(form?.get("signature") ?? ""));
  if (!ev) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  try {
    await handlePaymentEvent(ev);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("liqpay callback:", e);
    return NextResponse.json({ error: "temporary" }, { status: 500 }); // LiqPay повторить пізніше
  }
}
