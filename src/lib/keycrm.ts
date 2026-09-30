// Клиент для KeyCRM Open API (https://openapi.keycrm.app/v1).
// Авторизация — заголовок "Authorization: Bearer <ключ>". Ключ хранится
// ТОЛЬКО в секрете Cloudflare KEYCRM_API_KEY, в код и в чат его не вставляем.
// KeyCRM использует для остатков сущность "offers" (варианты товара) —
// каждый offer имеет свой sku и свой остаток, у товара может быть несколько offers.

const BASE = "https://openapi.keycrm.app/v1";

export type KeycrmResponse = { status: number; ok: boolean; body: unknown };

export async function keycrmGet(
  path: string,
  params: Record<string, string | number> = {}
): Promise<KeycrmResponse> {
  const key = process.env.KEYCRM_API_KEY;
  if (!key) {
    throw new Error("KEYCRM_API_KEY не задана — додайте секрет у Cloudflare (Variables and secrets)");
  }

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // ответ не JSON — вернём как текст
  }
  return { status: res.status, ok: res.ok, body };
}
