// Ручна (повторна) передача одного замовлення в KeyCRM.
//   /api/orders/send?key=<SYNC_SECRET>&number=F-10001
import { NextRequest } from "next/server";
import { getRunner } from "@/lib/catalog";
import { sendOrderToKeycrm } from "@/lib/keycrm-orders";
import { checkKey, esc, htmlPage } from "@/lib/sync-page";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = checkKey(req);
  if (denied) return denied;
  const number = req.nextUrl.searchParams.get("number") ?? "";
  if (!/^F-\d+$/.test(number)) return htmlPage("<h3>Вкажіть номер замовлення, наприклад number=F-10001</h3>", 400);

  try {
    const run = getRunner();
    // дозволяємо нові спроби, навіть якщо автоматичні вже закінчились
    await run(`UPDATE "Order" SET "keycrmAttempts" = 0 WHERE "orderNumber" = $1 AND "keycrmOrderId" IS NULL`, [number]);
    const r = await sendOrderToKeycrm(run, number);
    const back = `<p><a href="/api/orders/list?key=${encodeURIComponent(req.nextUrl.searchParams.get("key") ?? "")}">← до списку замовлень</a></p>`;
    if (r.ok) {
      return htmlPage(`<h3>${esc(number)}: ${r.already ? "вже було в KeyCRM" : "передано в KeyCRM"} (№${esc(r.keycrmId)})</h3>${back}`);
    }
    return htmlPage(`<h3>${esc(number)}: не вдалося передати</h3><pre style="white-space:pre-wrap">${esc(r.error)}</pre>${back}`, 502);
  } catch (e) {
    return htmlPage(`<h3>Помилка</h3><pre style="white-space:pre-wrap">${esc(e instanceof Error ? e.message : String(e))}</pre>`, 500);
  }
}
