// Маленькое хранилище "на чём остановились" для автоматической синхронизации.
import type { Run } from "./catalog";

export async function getState(run: Run, key: string): Promise<string | null> {
  const rows = await run(`SELECT value FROM "SyncState" WHERE key = $1`, [key]);
  return rows[0] ? String(rows[0].value) : null;
}

export async function setState(run: Run, key: string, value: string): Promise<void> {
  await setStates(run, { [key]: value });
}

// Несколько ключей одним запросом (меньше обращений к базе в окне синхронизации)
export async function getStates(run: Run, keys: string[]): Promise<Record<string, string>> {
  const rows = await run(`SELECT key, value FROM "SyncState" WHERE key = ANY($1::text[])`, [keys]);
  const out: Record<string, string> = {};
  for (const r of rows) out[String(r.key)] = String(r.value);
  return out;
}

// Запись нескольких ключей одним запросом; строка не перезаписывается, если значение не изменилось
export async function setStates(run: Run, entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  if (!keys.length) return;
  await run(
    `INSERT INTO "SyncState"(key, value, "updatedAt")
     SELECT k, v, now() FROM unnest($1::text[], $2::text[]) AS t(k, v)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()
     WHERE "SyncState".value IS DISTINCT FROM EXCLUDED.value`,
    [keys, keys.map((k) => entries[k])]
  );
}
