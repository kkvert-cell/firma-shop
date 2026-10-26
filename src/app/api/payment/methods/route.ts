import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Чи підключена онлайн-оплата (форма оформлення показує пункт «Картка онлайн», лише якщо так)
export async function GET() {
  return NextResponse.json({ online: activeProvider() !== null });
}
