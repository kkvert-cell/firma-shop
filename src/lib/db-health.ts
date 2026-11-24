// Признак «во время этого запроса к сайту база вернула ошибку».
// Нужен кэшу страниц: страница при сбое базы может нарисовать «тимчасово недоступно» с кодом 200,
// и такой ответ нельзя запоминать как успешный. Хранится в контексте конкретного запроса (AsyncLocalStorage),
// поэтому параллельные запросы друг на друга не влияют.
// Только относительные импорты: файл используется и в cron-воркере.

import { AsyncLocalStorage } from "node:async_hooks";

export type DbHealth = { error: boolean };

// Воркер (кэш страниц) и сайт (OpenNext) собираются отдельно и получают каждый СВОЮ копию этого файла.
// Чтобы признак ошибки был общим, хранилище кладём в глобальный реестр по общему ключу.
const KEY = Symbol.for("firma-shop.dbHealth");
const g = globalThis as unknown as Record<symbol, AsyncLocalStorage<DbHealth> | undefined>;
export const dbHealth: AsyncLocalStorage<DbHealth> = (g[KEY] ??= new AsyncLocalStorage<DbHealth>());

export function markDbError(): void {
  const s = dbHealth.getStore();
  if (s) s.error = true;
}
