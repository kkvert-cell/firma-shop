// ============================================================================
// Интеграция с LiqPay для онлайн-оплаты картой. Как и с Новой поштой —
// код готов, но без ключей (LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY из
// кабинета продавца LiqPay) реальный платёж провести нельзя.
// ============================================================================

import crypto from "crypto";

const PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY;
const PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY;

// Формирует данные для кнопки оплаты на странице checkout.
// LiqPay требует подпись (signature) — хеш от данных заказа + приватного ключа,
// чтобы никто не мог подделать сумму платежа со стороны браузера.
export function createLiqPayPayment(orderId: string, amount: number) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.warn("LIQPAY_PUBLIC_KEY/PRIVATE_KEY не задані — оплата вимкнена (заготовка)");
    return null;
  }

  const payload = {
    version: 3,
    public_key: PUBLIC_KEY,
    action: "pay",
    amount,
    currency: "UAH",
    description: `Замовлення ${orderId}`,
    order_id: orderId,
    result_url: `https://firma-shop.ua/checkout/success?order=${orderId}`,
    server_url: `https://firma-shop.ua/api/webhooks/liqpay`,
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto
    .createHash("sha1")
    .update(PRIVATE_KEY + data + PRIVATE_KEY)
    .digest("base64");

  return { data, signature };
}

// Обработчик вебхука — LiqPay сам стучится сюда после оплаты, чтобы сообщить
// статус. Здесь мы проверяем подпись и обновляем Payment.status в БД.
export function verifyLiqPayCallback(data: string, signature: string): boolean {
  if (!PRIVATE_KEY) return false;
  const expected = crypto
    .createHash("sha1")
    .update(PRIVATE_KEY + data + PRIVATE_KEY)
    .digest("base64");
  return expected === signature;
}
