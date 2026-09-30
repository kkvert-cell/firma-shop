// ВРЕМЕННЫЙ диагностический адрес: показывает по несколько примеров остатков
// из KeyCRM, чтобы увидеть реальные названия полей (sku, quantity, reserve
// и т.п.) и правильно написать сверку. После настройки удаляется.
//
// Открывать так: /api/keycrm/probe?key=<значение секрета SYNC_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { keycrmGet } from "@/lib/keycrm";

export const dynamic = "force-dynamic";

function firstItems(body: unknown, n: number): unknown {
  if (body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).data)) {
    const obj = body as Record<string, unknown>;
    return { ...obj, data: (obj.data as unknown[]).slice(0, n) };
  }
  return body;
}

export async function GET(req: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const given = req.nextUrl.searchParams.get("key");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const targets: [string, string, Record<string, number>][] = [
    ["offers_stocks", "/offers/stocks", { limit: 5 }],
    ["offers", "/offers", { limit: 3 }],
    ["products", "/products", { limit: 2 }],
  ];

  const out: Record<string, unknown> = {};
  for (const [name, path, params] of targets) {
    try {
      const r = await keycrmGet(path, params);
      out[name] = { status: r.status, body: firstItems(r.body, 5) };
    } catch (e) {
      out[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json(out);
}
