// Автоматичне оновлення каталогу з Prom (ціни, назви, описи, фото, нові товари).
// Працює порціями: кожен запуск за розкладом обробляє частину фіда й запам'ятовує місце;
// коли весь фід пройдено, чекає кілька годин і починає наступне коло.
// Залишки й наявність сюди не входять — вони приходять із KeyCRM (див. keycrm-sync.ts).
// Тільки відносні імпорти: файл використовується в cron-воркері.

import type { Run } from "./catalog";
import { notifyOwner } from "./notify";
import { parseItem, splitItems } from "./prom-feed";
import { importItems, markMissing, type SqlRunner } from "./prom-sync";
import { getState, setState } from "./sync-state";

const KEY = "prom_refresh";
const PORTION = 200; // товарів за один запуск
const MIN_COVERAGE = 0.98; // «зниклі» товари ховаємо, лише якщо фід пройдено майже повністю

export type PromRefreshState = {
  active: boolean; // зараз іде коло оновлення
  runTs: string | null; // мітка поточного кола
  cursor: number; // скільки товарів фіда вже оброблено в цьому колі
  total: number; // скільки всього товарів у фіді
  lastDone: string | null; // коли останнє коло завершилось
  fails: number; // невдалих запусків поспіль
  partial?: number; // кіл поспіль, у яких фід «зсунувся» і частину товарів пропущено
};

const EMPTY: PromRefreshState = { active: false, runTs: null, cursor: 0, total: 0, lastDone: null, fails: 0 };
const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
const parseTs = (s: string) => new Date(s.replace(" ", "T") + "Z").getTime();

export async function loadPromState(run: Run): Promise<PromRefreshState> {
  try {
    const raw = await getState(run, KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

const save = (run: Run, st: PromRefreshState) => setState(run, KEY, JSON.stringify(st));

// Просить почати нове коло при найближчому запуску за розкладом
export async function requestPromRefresh(run: Run): Promise<void> {
  const st = await loadPromState(run);
  await save(run, { ...st, active: false, cursor: 0, lastDone: null, fails: 0 });
}

export type RefreshResult =
  | { status: "idle" }
  | { status: "portion"; from: number; done: number; total: number; products: number }
  | { status: "finished"; total: number; hidden: number | null }
  | { status: "incomplete"; covered: number; total: number }
  | { status: "failed"; error: string; fails: number };

export async function promRefreshStep(run: Run, feedUrl: string, now: Date = new Date(), refreshHours = 12): Promise<RefreshResult> {
  let st = await loadPromState(run);

  if (!st.active) {
    if (st.lastDone && now.getTime() - parseTs(st.lastDone) < refreshHours * 3600_000) return { status: "idle" };
    st = { ...st, active: true, runTs: fmt(now), cursor: 0 };
  }
  const runTs = st.runTs ?? fmt(now);

  try {
    const res = await fetch(feedUrl, { cache: "no-store", headers: { "user-agent": "firma-shop-sync/1.0" } });
    if (!res.ok) throw new Error(`Фід Prom не відкрився (код ${res.status})`);
    const items = splitItems(await res.text());
    const total = items.length;
    if (total === 0) throw new Error("У фіді Prom немає товарів");

    const from = st.cursor;
    const slice = items.slice(from, from + PORTION).map(parseItem).filter((i) => i !== null);
    const stats = slice.length ? await importItems(run as SqlRunner, slice, runTs) : { products: 0 };
    const cursor = from + PORTION;

    if (cursor < total) {
      await save(run, { ...st, runTs, cursor, total, fails: 0 });
      return { status: "portion", from, done: Math.min(cursor, total), total, products: stats.products };
    }

    // Фід пройдено. Товари, яких у ньому більше немає, ховаємо лише якщо ВСІ (майже) товари теперішнього фіда
    // в цьому колі справді оброблено. Якщо Prom змінив фід посеред кола, індекси «зсунулись» і частину товарів
    // могло бути пропущено — тоді нічого не ховаємо й одразу починаємо коло заново.
    const feedIds = items.map((raw) => /<g:id>\s*(?:<!\[CDATA\[)?\s*(\d+)/.exec(raw)?.[1]).filter((v): v is string => !!v);
    const covered = Number(
      (await run(`SELECT count(*)::int AS n FROM "Product" WHERE "syncedAt" >= $1::timestamp AND "externalId" = ANY($2::text[])`, [runTs, feedIds]))[0]?.n ?? 0
    );
    const partial = st.partial ?? 0;
    if (covered < total * MIN_COVERAGE && partial < 2) {
      console.warn(`[prom] Коло неповне (оброблено ${covered} із ${total}), починаємо заново; «зниклі» товари не ховаємо`);
      await save(run, { ...st, active: false, runTs: null, cursor: 0, total, lastDone: null, fails: 0, partial: partial + 1 });
      return { status: "incomplete", covered, total };
    }
    const hidden = covered >= total * MIN_COVERAGE ? await markMissing(run as SqlRunner, runTs) : null;
    await save(run, { active: false, runTs: null, cursor: 0, total, lastDone: fmt(now), fails: 0, partial: 0 });
    return { status: "finished", total, hidden };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    const fails = st.fails + 1;
    await save(run, { ...st, runTs, fails });
    if (fails === 3) await notifyOwner(`⚠️ Автооновлення каталогу з Prom не вдалось 3 рази поспіль: ${msg}`);
    return { status: "failed", error: msg, fails };
  }
}
