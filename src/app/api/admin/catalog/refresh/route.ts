import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { apiAdminOk } from "@/lib/admin-auth";
import { requestPromRefresh } from "@/lib/prom-refresh";

export const dynamic = "force-dynamic";

// «Оновити каталог зараз»: наступний запуск за розкладом (до 10 хвилин) почне нове коло оновлення
export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  await requestPromRefresh(getRunner());
  return NextResponse.redirect(new URL("/admin/tools?ok=refresh", req.url), 303);
}
