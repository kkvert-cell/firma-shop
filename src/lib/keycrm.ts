// Клиент для KeyCRM Open API (https://openapi.keycrm.app/v1).
// Авторизация — заголовок "Authorization: Bearer <ключ>". Ключ хранится
// ТОЛЬКО в секрете Cloudflare KEYCRM_API_KEY, в код и в чат его не вставляем.
// KeyCRM использует для остатков сущность "offers" (варианты товара) —
// каждый offer имеет свой sku и свой остаток, у товара может быть несколько offers.

const DEFAULT_BASE = "https://openapi.keycrm.app/v1";

export type KeycrmResponse = { status: number; ok: boolean; body: unknown };

async function keycrmCall(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number> = {},
  payload?: unknown
): Promise<KeycrmResponse> {
  const key = process.env.KEYCRM_API_KEY;
  if (!key) {
    throw new Error("KEYCRM_API_KEY не задана — додайте секрет у Cloudflare (Variables and secrets)");
  }

  const url = new URL((process.env.KEYCRM_BASE_URL ?? DEFAULT_BASE) + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  if (method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(payload) : undefined,
    cache: "no-store",
    // не ждём KeyCRM дольше 10 секунд, чтобы не зависать
    signal: AbortSignal.timeout(10_000),
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

export const keycrmGet = (path: string, params: Record<string, string | number> = {}) =>
  keycrmCall("GET", path, params);

export const keycrmPost = (path: string, payload: unknown) => keycrmCall("POST", path, {}, payload);
