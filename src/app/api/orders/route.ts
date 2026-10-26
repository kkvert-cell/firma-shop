import { after, NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { createOrder, validateOrder } from "@/lib/orders";
import { sendOrderToKeycrm } from "@/lib/keycrm-orders";
import { notifyOwner } from "@/lib/notify";
import { activeProvider } from "@/lib/payments";
import { formatPrice } from "@/lib/site";

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

  if (v.value.payment === "ONLINE_CARD" && !activeProvider()) {
    return NextResponse.json({ error: "Перевірте виділені поля", fields: { payment: "Онлайн-оплата поки недоступна. Оберіть інший спосіб." } }, { status: 422 });
  }

  try {
    const r = await createOrder(getRunner(), v.value);
    if (!r.ok) return NextResponse.json({ error: r.error, problems: r.problems }, { status: r.status });
    // Покупатель уже получил ответ; остальное делаем «за кадром». Если KeyCRM не ответит — cron повторит.
    // Заказы с онлайн-оплатой уходят в KeyCRM и к владелице только после успешной оплаты.
    if (r.created) {
      const number = r.orderNumber;
      const v2 = v.value;
      after(async () => {
        try {
          if (v2.payment !== "ONLINE_CARD") {
            await notifyOwner(`🛒 Нове замовлення ${number} на ${formatPrice(r.total ?? 0)} ₴: ${v2.lastName} ${v2.firstName}, ${v2.phone}.`);
            if (process.env.KEYCRM_API_KEY) await sendOrderToKeycrm(getRunner(), number);
          }
        } catch (e) {
          console.error("order after:", e);
        }
      });
    }
    return NextResponse.json({ orderNumber: r.orderNumber, token: r.token });
  } catch (err) {
    console.error("orders:", err);
    return NextResponse.json({ error: "Не вдалося оформити замовлення. Спробуйте ще раз або зателефонуйте нам." }, { status: 500 });
  }
}
