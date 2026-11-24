// Кэш публичных страниц (Cloudflare Cache API). Подключается в worker.ts, работает ДО Next.js.
// Цель: посетители, роботы Google и предпросмотры ссылок не будят базу, пока страница свежая.
//
// Что кэшируется: только GET публичных страниц из списка pageRule(): главная, каталог, подборки, товары, справочные страницы, sitemap.xml.
// Что НЕ кэшируется никогда: кабинет, заказы, корзина, оформление, админка, API, поиск, любые запросы с cookie входа,
//   запросы клиентской навигации Next.js (RSC), ответы с Set-Cookie, ответы 5xx и страницы, при отрисовке которых база вернула ошибку.
// Устаревшая копия отдаётся (до 24 часов), только если свежую получить не удалось (ошибка базы, 5xx, исключение).
// Клиентам всегда уходит Cache-Control: no-store: браузер и промежуточные кэши ничего не запоминают, кэш — только наш.
// Выключатель: переменная PAGE_CACHE=off.
// Только относительные импорты.

import { dbHealth } from "./db-health";

export type CacheStore = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };
export type WaitUntil = { waitUntil(p: Promise<unknown>): void };
export type PageCacheOptions = { cache: CacheStore; enabled: boolean; now?: () => number };

export const STALE_MAX_MS = 24 * 3600_000; // сколько хранить копию «на случай сбоя»
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const TRACKING = /^(utm_|fbclid$|gclid$|yclid$|msclkid$|_ga$|_gl$|mc_|igshid$)/i;
const NEVER_PARAMS = new Set(["dbg", "key", "t", "token"]);

export type PageRule = { ttl: number; negTtl: number }; // секунды; negTtl — как долго помнить «404»
export function pageRule(pathname: string): PageRule | null {
  if (pathname === "/") return { ttl: 600, negTtl: 0 };
  if (pathname === "/catalog" || pathname.startsWith("/catalog/")) return { ttl: 600, negTtl: 120 };
  if (pathname.startsWith("/collection/")) return { ttl: 600, negTtl: 120 };
  if (pathname.startsWith("/product/")) return { ttl: 300, negTtl: 120 }; // товары: цена и наличие меняются чаще, срок короче
  if (pathname.startsWith("/info/")) return { ttl: 3600, negTtl: 120 };
  if (pathname === "/sitemap.xml") return { ttl: 21600, negTtl: 0 };
  return null;
}

// Запрос нельзя обслуживать из общего кэша
export function mustBypass(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return true;
  const h = req.headers;
  if (h.has("authorization") || h.has("rsc") || h.has("next-router-prefetch") || h.has("next-router-state-tree") || h.has("x-nextjs-data")) return true;
  const cookie = h.get("cookie") ?? "";
  if (/(^|;\s*)firma_(admin|customer)=/.test(cookie)) return true;
  return false;
}

// Ключ кэша: адрес без трекинговых параметров, параметры по алфавиту. null — страницу кэшировать нельзя (подозрительный адрес).
export function cacheKey(url: URL): string | null {
  const params = [...url.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
  if (params.some(([k]) => NEVER_PARAMS.has(k.toLowerCase()))) return null;
  if (params.length > 8 || url.search.length > 300) return null; // защита от «взрыва» ключей
  params.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const q = new URLSearchParams(params).toString();
  return `${url.origin}${url.pathname}${q ? "?" + q : ""}`;
}

const CACHEABLE_TYPE = /^(text\/html|application\/xml|text\/xml|text\/plain)/i;

function storable(res: Response, rule: PageRule): "ok" | "neg" | null {
  if (res.headers.has("set-cookie")) return null;
  if (/\bprivate\b/i.test(res.headers.get("cache-control") ?? "")) return null;
  if (!CACHEABLE_TYPE.test(res.headers.get("content-type") ?? "")) return null;
  if (res.status === 200) return "ok";
  if (res.status === 404 && rule.negTtl > 0) return "neg";
  return null;
}

function out(res: Response, state: string, head: boolean): Response {
  const h = new Headers(res.headers);
  h.set("cache-control", "no-store");
  h.set("x-page-cache", state);
  h.delete("x-cached-at");
  h.delete("x-cache-ttl");
  return new Response(head ? null : res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export async function withPageCache(req: Request, origin: () => Promise<Response>, ctx: WaitUntil, opts: PageCacheOptions): Promise<Response> {
  const url = new URL(req.url);
  const rule = opts.enabled ? pageRule(url.pathname) : null;
  const key = rule && !mustBypass(req) ? cacheKey(url) : null;
  if (!rule || !key) return origin();

  const head = req.method === "HEAD";
  const keyReq = new Request(key, { method: "GET" });
  const now = opts.now ?? Date.now;

  let hit: Response | undefined;
  try {
    hit = await opts.cache.match(keyReq);
  } catch {
    hit = undefined;
  }
  const t0 = now();
  const cachedAt = hit ? Number(hit.headers.get("x-cached-at")) : NaN;
  const ttlMs = hit ? Number(hit.headers.get("x-cache-ttl")) * 1000 : 0;
  const age = hit && Number.isFinite(cachedAt) ? t0 - cachedAt : Infinity;
  if (hit && age >= 0 && age < ttlMs) return out(hit, "HIT", head);

  // HEAD без свежей копии: пропускаем напрямую и ничего не запоминаем (у такого ответа нет тела)
  if (head) return origin();

  // Свежей копии нет — идём в Next.js (и в базу), следим за ошибками базы
  const health = { error: false };
  let res: Response | null = null;
  try {
    res = await dbHealth.run(health, origin);
  } catch {
    res = null;
  }

  const kind = res && !health.error ? storable(res, rule) : null;
  if (res && kind) {
    const copy = res.clone();
    const ttl = kind === "ok" ? rule.ttl : rule.negTtl;
    ctx.waitUntil(
      (async () => {
        try {
          const buf = await copy.arrayBuffer();
          if (buf.byteLength > MAX_BODY_BYTES) return;
          const h = new Headers({ "content-type": copy.headers.get("content-type") ?? "text/html; charset=utf-8" });
          h.set("x-cached-at", String(t0));
          h.set("x-cache-ttl", String(ttl));
          h.set("cache-control", `public, max-age=${Math.floor(STALE_MAX_MS / 1000)}`);
          await opts.cache.put(keyReq, new Response(buf, { status: copy.status, headers: h }));
        } catch {
          // кэш недоступен — просто не запомним
        }
      })()
    );
    return out(res, "MISS", head);
  }

  // Свежее получить не удалось (ошибка базы, 5xx, исключение): отдаём устаревшую копию, если она есть и не старше суток
  const failed = !res || health.error || res.status >= 500;
  if (failed && hit && age >= 0 && age < STALE_MAX_MS) return out(hit, "STALE", head);
  if (!res) return new Response("Сервіс тимчасово недоступний", { status: 503, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } });
  return out(res, health.error ? "SKIP-DBERR" : "SKIP", head);
}
