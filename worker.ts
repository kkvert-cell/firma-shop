// Точка входа воркера Cloudflare: обычный сайт (OpenNext) + запуск по расписанию.
// ВАЖНО: файл собирает wrangler, а не Next.js (поэтому он исключён из tsconfig).
// @ts-ignore — файл создаётся при сборке (opennextjs-cloudflare build)
import handler from "./.open-next/worker.js";
import { runScheduled } from "./src/lib/scheduled";

export default {
  fetch: handler.fetch,

  async scheduled(event: { scheduledTime: number }, env: Record<string, unknown>, ctx: { waitUntil(p: Promise<unknown>): void }) {
    // Next.js читает настройки из process.env; для запуска по расписанию переносим секреты туда сами
    for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
    ctx.waitUntil(runScheduled(new Date(event.scheduledTime)));
  },
};

// Служебные классы OpenNext (нужны, только если подключён расширенный кэш; без них ничего не меняется)
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
