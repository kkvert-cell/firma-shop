// Свіжі ціни й наявність для товарів з кошика (кошик у браузері міг "застаріти").
import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const raw = (body as { ids?: unknown })?.ids;
  const ids = (Array.isArray(raw) ? raw : []).filter((x): x is string => typeof x === "string" && /^[0-9a-zA-Z-]{6,64}$/.test(x)).slice(0, 60);
  if (ids.length === 0) return NextResponse.json({ items: [] });

  try {
    const rows = await getRunner()(
      `SELECT p.id, p.name, p.slug, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice", p."isAvailable",
              p."stockQty", (p."stockSyncedAt" IS NOT NULL) AS "stockExact",
              (SELECT i.url FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i."sortOrder" LIMIT 1) AS image
       FROM "Product" p WHERE p.id = ANY($1::text[]) AND p."isHidden" = false`,
      [ids]
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("cart/check:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
