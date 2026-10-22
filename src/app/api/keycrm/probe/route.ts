// ВРЕМЕННАЯ диагностика KeyCRM: показывает, как в KeyCRM устроены источники и заказы,
// чтобы правильно передавать заказы с сайта. Личные данные покупателей (имена, телефоны,
// адреса, комментарии) в ответе заменяются на "***".
//   /api/keycrm/probe?key=<SYNC_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { keycrmGet } from "@/lib/keycrm";

export const dynamic = "force-dynamic";

const PERSONAL = /name|phone|email|address|city|comment|recipient|receive_point|tracking|ttn|note|description|street|zip|region|house|apartment|warehouse|login|password|token/i;
const KEEP = new Set(["shipping_service", "delivery_service_id", "name_ua"]);

function mask(v: unknown, key = ""): unknown {
  if (Array.isArray(v)) return v.map((x) => mask(x, key));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, mask(x, k)]));
  }
  if (typeof v === "string" && v && PERSONAL.test(key) && !KEEP.has(key)) return "***";
  return v;
}

function firstItems(body: unknown, n: number): unknown {
  if (body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).data)) {
    const obj = body as Record<string, unknown>;
    return { ...obj, data: (obj.data as unknown[]).slice(0, n), links: undefined, first_page_url: undefined, last_page_url: undefined };
  }
  return body;
}

export async function GET(req: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret || req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const targets: [string, string, Record<string, string | number>][] = [
    ["order_sources", "/order/source", { limit: 20 }],
    ["order_statuses", "/order/status", { limit: 30 }],
    ["order_example", "/order", { limit: 1, include: "buyer,products,shipping,payments", "sort": "-id" }],
  ];

  const out: Record<string, unknown> = {};
  for (const [name, path, params] of targets) {
    try {
      const r = await keycrmGet(path, params);
      out[name] = { status: r.status, body: mask(firstItems(r.body, name === "order_example" ? 1 : 20)) };
    } catch (e) {
      out[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json(out);
}
