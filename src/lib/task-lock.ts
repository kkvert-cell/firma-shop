// Замки для фоновых задач: не даём двум синхронизациям (cron, ручной запуск из админки, повторный cron) работать одновременно.
// Замок — строка в SyncState со сроком жизни: если воркер упал, замок снимается сам по истечении срока.
// Берётся одним атомарным запросом (подключение Neon по HTTP не держит сессию, поэтому advisory-замки Postgres тут не подходят).

import type { Run } from "./catalog";

const rand = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;

export async function acquireLock(run: Run, name: string, ttlMs: number, now: Date = new Date()): Promise<string | null> {
  const owner = rand();
  const expires = new Date(now.getTime() + ttlMs).toISOString();
  const rows = await run(
    `INSERT INTO "SyncState"(key, value, "updatedAt") VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()
     WHERE split_part("SyncState".value, '|', 1) < $3
     RETURNING key`,
    [`lock:${name}`, `${expires}|${owner}`, now.toISOString()]
  );
  return rows.length ? owner : null;
}

export async function releaseLock(run: Run, name: string, owner: string): Promise<void> {
  await run(`DELETE FROM "SyncState" WHERE key = $1 AND split_part(value, '|', 2) = $2`, [`lock:${name}`, owner]);
}

export type LockResult<T> = { ran: true; value: T } | { ran: false };

export async function withLock<T>(run: Run, name: string, ttlMs: number, fn: () => Promise<T>): Promise<LockResult<T>> {
  const owner = await acquireLock(run, name, ttlMs);
  if (!owner) return { ran: false };
  try {
    return { ran: true, value: await fn() };
  } finally {
    await releaseLock(run, name, owner).catch(() => undefined); // не снялся — снимется по сроку
  }
}
