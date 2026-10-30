import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { EMPTY_SUGGESTIONS, suggest } from "@/lib/search-suggest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  try {
    return NextResponse.json(await suggest(getRunner(), q));
  } catch (e) {
    console.error("search suggest:", e);
    return NextResponse.json(EMPTY_SUGGESTIONS);
  }
}
