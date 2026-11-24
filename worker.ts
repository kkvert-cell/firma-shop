// Точка входа воркера Cloudflare: обычный сайт (OpenNext) + запуск по расписанию.
// ВАЖНО: файл собирает wrangler, а не Next.js (поэтому он исключён из tsconfig).
// @ts-ignore — файл создаётся при сборке (opennextjs-cloudflare build)
import handler from "./.open-next/worker.js";
import { CRON_PROM, runPromRefresh, runScheduled } from "./src/lib/scheduled";
import { withPageCache } from "./src/lib/page-cache";

export default {
  // Кэш публичных страниц перед Next.js (см. src/lib/page-cache.ts); PAGE_CACHE=off отключает его
  async fetch(request: Request, env: Record<string, unknown>, ctx: { waitUntil(p: Promise<unknown>): void }) {
    (globalThis as unknown as { __FIRMA_ENV?: unknown }).__FIRMA_ENV = env; // привязки Cloudflare (Hyperdrive) для src/lib/db.ts
    const store = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
    if (!store) return handler.fetch(request, env, ctx);
    return withPageCache(request, () => handler.fetch(request, env, ctx), ctx, { cache: store, enabled: env.PAGE_CACHE !== "off" });
  },

  async scheduled(event: { scheduledTime: number; cron?: string }, env: Record<string, unknown>, ctx: { waitUntil(p: Promise<unknown>): void }) {
    // Next.js читает настройки из process.env; для запуска по расписанию переносим секреты туда сами
    for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
    (globalThis as unknown as { __FIRMA_ENV?: unknown }).__FIRMA_ENV = env;
    const when = new Date(event.scheduledTime);
    ctx.waitUntil(event.cron === CRON_PROM ? runPromRefresh(when) : runScheduled(when));
  },
};

// Служебные классы OpenNext (нужны, только если подключён расширенный кэш; без них ничего не меняется)
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
