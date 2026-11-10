// Масова зміна цін: op=apply (застосувати), op=unlock (зняти захист ціни від Prom); GET — резервна копія цін у CSV
import { NextRequest, NextResponse } from "next/server";
import { apiAdminOk } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { BULK_KEYS, bulkError, changeCond, newPriceSql, parseBulk, scopeWhere } from "@/lib/bulk-price";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, q: URLSearchParams) => NextResponse.redirect(new URL(`/admin/prices?${q}`, req.url), 303);

function keep(get: (k: string) => string | null): URLSearchParams {
  const q = new URLSearchParams();
  for (const k of BULK_KEYS) {
    const v = get(k);
    if (v) q.set(k, v);
  }
  return q;
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const b = parseBulk((k) => sp.get(k));
  const params: unknown[] = [];
  const where = scopeWhere(b, params, { skipSale: false });
  const rows = await getRunner()(
    `SELECT p."vendorCode", p.name, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice", p.id
       FROM "Product" p WHERE ${where} ORDER BY p.name`,
    params
  );
  const csv =
    "\uFEFF" + ["Артикул;Назва;Ціна;Стара ціна;ID", ...rows.map((r) => [csvCell(r.vendorCode), csvCell(r.name), String(r.price).replace(".", ","), r.oldPrice == null ? "" : String(r.oldPrice).replace(".", ","), csvCell(r.id)].join(";"))].join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="prices-backup.csv"` } });
}

export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const f = await req.formData();
  const get = (k: string) => (f.get(k) == null ? null : String(f.get(k)));
  const op = get("op");
  const q = keep(get);
  const b = parseBulk(get);
  const run = getRunner();

  if (op === "unlock") {
    if (get("confirm") !== "yes") {
      q.set("err", "Поставте позначку, щоб підтвердити");
      return back(req, q);
    }
    if (b.scope === "category" && !b.categoryId) {
      q.set("err", "Виберіть категорію зі списку");
      return back(req, q);
    }
    const params: unknown[] = [];
    const where = scopeWhere(b, params, { skipSale: false });
    const rows = await run(
      `UPDATE "Product" p SET "lockedFields" = array_remove(p."lockedFields", 'price'), "updatedAt" = now()
        WHERE ${where} AND 'price' = ANY(p."lockedFields") RETURNING p.id`,
      params
    );
    const done = new URLSearchParams();
    done.set("ok", "unlocked");
    done.set("n", String(rows.length));
    return back(req, done);
  }

  if (op === "apply") {
    const e = bulkError(b);
    if (e) {
      q.set("err", e);
      return back(req, q);
    }
    if (get("confirm") !== "yes") {
      q.set("err", "Поставте позначку, щоб підтвердити зміну цін");
      return back(req, q);
    }
    // Рахуємо ще раз і порівнюємо з тим, що бачили в попередньому перегляді
    const cp: unknown[] = [];
    const cw = scopeWhere(b, cp, { skipSale: true });
    const cn = newPriceSql(b, cp);
    const cnt = await run(`SELECT count(*) FILTER (WHERE ${changeCond(b, cn)})::int AS n FROM "Product" p WHERE ${cw}`, cp);
    const expect = Number(get("expect") ?? -1);
    if (Number(cnt[0]?.n ?? 0) !== expect) {
      q.set("err", "Дані змінилися, поки ви дивилися перегляд. Перевірте ще раз");
      return back(req, q);
    }
    const params: unknown[] = [];
    const where = scopeWhere(b, params, { skipSale: true });
    const np = newPriceSql(b, params);
    const rows = await run(
      `UPDATE "Product" p SET price = ${np}, "updatedAt" = now(),
              "lockedFields" = CASE WHEN p."externalId" IS NOT NULL AND NOT ('price' = ANY(p."lockedFields")) THEN array_append(p."lockedFields", 'price') ELSE p."lockedFields" END
        WHERE ${where} AND ${changeCond(b, np)} RETURNING p.id`,
      params
    );
    const ids = rows.map((r) => String(r.id));
    if (ids.length) {
      // Записуємо нові ціни в історію цін
      await run(
        `INSERT INTO "PriceLog"("productId", price)
         SELECT p.id, p.price FROM "Product" p
          WHERE p.id = ANY($1::text[]) AND p.price IS DISTINCT FROM (SELECT l.price FROM "PriceLog" l WHERE l."productId" = p.id ORDER BY l."recordedAt" DESC, l.id DESC LIMIT 1)`,
        [ids]
      );
    }
    const done = new URLSearchParams();
    done.set("ok", "applied");
    done.set("n", String(ids.length));
    return back(req, done);
  }

  return new NextResponse("Bad request", { status: 400 });
}
