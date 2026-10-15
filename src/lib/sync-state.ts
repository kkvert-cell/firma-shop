// Маленькое хранилище "на чём остановились" для автоматической синхронизации.
import type { Run } from "./catalog";

export async function getState(run: Run, key: string): Promise<string | null> {
  const rows = await run(`SELECT value FROM "SyncState" WHERE key = $1`, [key]);
  return rows[0] ? String(rows[0].value) : null;
}

export async function setState(run: Run, key: string, value: string): Promise<void> {
  await run(
    `INSERT INTO "SyncState"(key, value, "updatedAt") VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`,
    [key, value]
  );
}
