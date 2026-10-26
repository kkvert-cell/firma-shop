import { NextRequest, NextResponse } from "next/server";
import { handlePaymentEvent } from "@/lib/payment-events";
import { parseWayforpayCallback, wfpAccept } from "@/lib/payments";

export const dynamic = "force-dynamic";

// WayForPay надсилає JSON (інколи як ключ форми) і чекає підписану відповідь «accept».
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    const first = [...new URLSearchParams(raw).keys()][0];
    try {
      body = first ? JSON.parse(first) : null;
    } catch {
      body = null;
    }
  }
  const ev = body ? parseWayforpayCallback(body) : null;
  if (!ev || !body) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  try {
    await handlePaymentEvent(ev);
    return NextResponse.json(wfpAccept(String(body.orderReference)));
  } catch (e) {
    console.error("wayforpay callback:", e);
    return NextResponse.json({ error: "temporary" }, { status: 500 });
  }
}
