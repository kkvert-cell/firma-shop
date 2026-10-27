// Що робимо, коли оплата підтверджена: повідомляємо власницю й передаємо замовлення в KeyCRM.
import { after } from "next/server";
import { getRunner } from "./catalog";
import { notifyOwner } from "./notify";
import { sendOrderEmail } from "./order-email";
import { sendOrderToKeycrm } from "./keycrm-orders";
import { applyPayment, type PaymentEvent } from "./payments";

export async function handlePaymentEvent(ev: PaymentEvent): Promise<string> {
  const run = getRunner();
  const r = await applyPayment(run, ev);
  if (r.changed) {
    after(async () => {
      try {
        if (ev.status === "PAID") {
          await sendOrderEmail(run, ev.orderNumber);
          await notifyOwner(`💳 Замовлення ${ev.orderNumber} оплачено карткою: ${r.total} ₴.`);
          if (process.env.KEYCRM_API_KEY) await sendOrderToKeycrm(run, ev.orderNumber);
        } else if (ev.status === "REFUNDED") {
          await notifyOwner(`↩️ Повернення коштів за замовлення ${ev.orderNumber}. Перевірте його в KeyCRM.`);
        }
      } catch (e) {
        console.error("payment after:", e);
      }
    });
  } else if (r.reason && r.reason !== "без змін" && r.reason !== "проміжний статус") {
    console.error(`[payment] ${ev.orderNumber}: ${r.reason}`);
    await notifyOwner(`⚠️ Платіж за ${ev.orderNumber} не прийнято автоматично: ${r.reason}. Перевірте в кабінеті платіжного сервісу.`);
  }
  return r.reason ?? "ok";
}
