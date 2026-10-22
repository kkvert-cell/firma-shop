import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { createOrder, validateOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 50_000) return NextResponse.json({ error: "Запит завеликий" }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }

  // "Медова пастка" для роботів: людина це поле не бачить і не заповнює
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }

  const v = validateOrder(body);
  if (!v.ok) return NextResponse.json({ error: "Перевірте виділені поля", fields: v.fields }, { status: 422 });

  try {
    const r = await createOrder(getRunner(), v.value);
    if (!r.ok) return NextResponse.json({ error: r.error, problems: r.problems }, { status: r.status });
    return NextResponse.json({ orderNumber: r.orderNumber, token: r.token });
  } catch (err) {
    console.error("orders:", err);
    return NextResponse.json({ error: "Не вдалося оформити замовлення. Спробуйте ще раз або зателефонуйте нам." }, { status: 500 });
  }
}
