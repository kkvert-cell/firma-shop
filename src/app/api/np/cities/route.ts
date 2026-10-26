import { NextRequest, NextResponse } from "next/server";
import { NpUnavailable, searchCities } from "@/lib/novaposhta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    return NextResponse.json({ items: await searchCities(q) });
  } catch (e) {
    // 503 — довідник не налаштований: форма перейде на ручне введення
    if (e instanceof NpUnavailable) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    console.error("np cities:", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
