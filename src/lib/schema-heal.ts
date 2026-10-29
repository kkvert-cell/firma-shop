// Страховка на случай, если новую версию сайта залили раньше, чем выполнили SQL-миграцию:
// при первой ошибке «нет такой колонки» добавляем недостающие колонки сами (операции безопасные и повторяемые)
// и повторяем запрос. Файл sql/migration-007-admin-edit.sql делает то же самое вручную.

import type { Run } from "./catalog";

const STATEMENTS = [
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "lockedFields" TEXT[] NOT NULL DEFAULT '{}'`,
];

const needsMigration = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /does not exist/i.test(m) && /(isHidden|lockedFields)/.test(m);
};

let healing: Promise<void> | null = null;

export function healRun(run: Run): Run {
  return async (q, p) => {
    try {
      return await run(q, p);
    } catch (e) {
      if (!needsMigration(e)) throw e;
      healing ??= (async () => {
        for (const s of STATEMENTS) await run(s, []);
      })().finally(() => {
        healing = null;
      });
      await healing;
      return run(q, p);
    }
  };
}
