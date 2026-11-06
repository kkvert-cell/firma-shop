// Масові дії з акціями: змінити дату закінчення для всіх діючих акцій або завершити їх зараз.
import { NextRequest, NextResponse } from "next/server";
import { apiAdminOk } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { endOfDayKyiv, maintainSales } from "@/lib/sales";

export const dynamic = "force-dynamic";

const go = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/admin/sales?${q}`, req.url), 303);

export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const f = await req.formData();
  const op = String(f.get("op") ?? "");
  const run = getRunner();
  try {
    if (op === "extend") {
      const day = String(f.get("date") ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return go(req, `err=${encodeURIComponent("Оберіть дату закінчення")}`);
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
      const max = new Date(Date.now() + 366 * 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
      if (day < today) return go(req, `err=${encodeURIComponent("Ця дата вже минула")}`);
      if (day > max) return go(req, `err=${encodeURIComponent("Дата задалеко: акція не може тривати понад рік")}`);
      const rows = await run(
        `WITH u AS (UPDATE "Product" SET "saleEndsAt" = ${endOfDayKyiv(1)}, "updatedAt" = now()
                     WHERE "saleEndsAt" IS NOT NULL AND "oldPrice" > price AND "saleEndsAt" > now() RETURNING 1)
         SELECT count(*)::int AS n FROM u`,
        [day]
      );
      return go(req, `ok=extended&n=${Number(rows[0]?.n ?? 0)}`);
    }
    if (op === "end_all") {
      if (f.get("confirm") !== "yes") return go(req, `err=${encodeURIComponent("Поставте галочку, щоб підтвердити завершення акцій")}`);
      await run(`UPDATE "Product" SET "saleEndsAt" = now() WHERE "saleEndsAt" IS NOT NULL AND "oldPrice" > price AND "saleEndsAt" > now()`);
      const m = await maintainSales(run);
      return go(req, `ok=ended&n=${m.ended}`);
    }
  } catch (e) {
    console.error("admin sales:", e);
    return go(req, `err=${encodeURIComponent("Не вдалося виконати дію. Спробуйте ще раз.")}`);
  }
  return new NextResponse("Bad request", { status: 400 });
}
