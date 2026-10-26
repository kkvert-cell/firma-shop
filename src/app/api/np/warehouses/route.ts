import { NextRequest, NextResponse } from "next/server";
import { NpUnavailable, searchWarehouses } from "@/lib/novaposhta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!/^[0-9a-fA-F-]{36}$/.test(city)) return NextResponse.json({ items: [] });
  try {
    return NextResponse.json({ items: await searchWarehouses(city, q) });
  } catch (e) {
    if (e instanceof NpUnavailable) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    console.error("np warehouses:", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
