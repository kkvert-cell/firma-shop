import { neon } from "@neondatabase/serverless";
// Берём только клиент (без пула pg-pool и «нативных» привязок): так в воркере меньше кода
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: у подпути pg/lib/client нет описания типов, используем типы основного пакета
import PgClient from "pg/lib/client.js";
import type { Client as PgClientType, ClientConfig } from "pg";
const Client = PgClient as unknown as new (config: ClientConfig) => PgClientType;
import { markDbError } from "./db-health";

// Все обращения к базе в проекте идут через один интерфейс: вызов sql(запрос, параметры) (и sql`...` в proxy.ts).
// Драйвер выбирается переменной DB_DRIVER, поэтому смена базы не требует правок остального кода:
//   neon       (по умолчанию) — HTTP-драйвер Neon, строка подключения DATABASE_URL
//   hyperdrive — Supabase (или любой Postgres) через Cloudflare Hyperdrive, привязка HYPERDRIVE в wrangler.json
//   postgres   — прямое TCP-подключение по DATABASE_URL: для тестов и локальной работы. Шифрованное (TLS) подключение из Workers напрямую
//                к Supabase на проверке не пройдено — на сайте использовать hyperdrive
// Структура таблиц описана в prisma/schema.prisma и sql/: запросы пишутся как обычный SQL, без ORM.
//
// getSql() создаёт подключение лениво (не при импорте файла), чтобы сборка не падала, если переменная DATABASE_URL
// временно не задана (например, при локальной сборке без .env).

type Sql = ReturnType<typeof neon>;
type Rows = Record<string, unknown>[];

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

// Привязки Cloudflare (Hyperdrive) приходят в env воркера; worker.ts кладёт его сюда перед обработкой каждого запроса
function workerEnv(): Record<string, unknown> {
  return ((globalThis as unknown as { __FIRMA_ENV?: Record<string, unknown> }).__FIRMA_ENV ?? {}) as Record<string, unknown>;
}

// Запрос в виде sql(текст, параметры) или sql`текст ${значение}`
function parseCall(args: unknown[]): { text: string; params: unknown[] | undefined } {
  const first = args[0];
  if (Array.isArray(first) && "raw" in (first as object)) {
    const strings = first as unknown as string[];
    const values = args.slice(1);
    return { text: strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), ""), params: values };
  }
  return { text: String(first), params: args[1] as unknown[] | undefined };
}

const MAX_PARALLEL = 4; // одновременных соединений на один runner: в Workers одновременно открытых соединений не больше 6

// Postgres по TCP (pg). На каждый запрос — своё короткое соединение: в Cloudflare Workers соединение нельзя
// переиспользовать между запросами сайта, а Hyperdrive держит пул у себя, поэтому открывать соединение дёшево.
function pgRunner(config: () => ClientConfig): Sql {
  let active = 0;
  const waiters: (() => void)[] = [];
  const acquire = async () => {
    if (active >= MAX_PARALLEL) await new Promise<void>((r) => waiters.push(r));
    active++;
  };
  const release = () => {
    active--;
    waiters.shift()?.();
  };
  const exec = async (text: string, params: unknown[] | undefined): Promise<Rows> => {
    await acquire();
    const client = new Client(config());
    try {
      await client.connect();
      const r = await client.query(text, params as unknown[]);
      return Array.isArray(r) ? (r[r.length - 1]?.rows ?? []) : r.rows; // несколько команд в одном запросе — результат последней
    } finally {
      await client.end().catch(() => undefined);
      release();
    }
  };
  const run = ((...args: unknown[]) => {
    const { text, params } = parseCall(args);
    return exec(text, params);
  }) as unknown as Sql;
  return run;
}

function createDriver(kind: string): Sql {
  const timeouts = { connectionTimeoutMillis: num(process.env.DB_CONNECT_TIMEOUT_MS, 8000), query_timeout: num(process.env.DB_QUERY_TIMEOUT_MS, 25000) };
  if (kind === "neon") {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задана — перевірте .env / налаштування хостингу");
    return neon(process.env.DATABASE_URL);
  }
  if (kind === "hyperdrive") {
    const cs = (workerEnv().HYPERDRIVE as { connectionString?: string } | undefined)?.connectionString;
    if (!cs) throw new Error("DB_DRIVER=hyperdrive, але привʼязку HYPERDRIVE не знайдено (wrangler.json → hyperdrive)");
    return pgRunner(() => ({ connectionString: cs, ...timeouts })); // Hyperdrive сам шифрує канал до базы
  }
  if (kind === "postgres") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задана — перевірте .env / налаштування хостингу");
    // Шифрование: DB_SSL=off — без него, DB_SSL=on — всегда; по умолчанию включено для всех адресов, кроме локальных
    const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
    const ssl = process.env.DB_SSL === "off" ? false : process.env.DB_SSL === "on" || !local ? { rejectUnauthorized: false } : false;
    return pgRunner(() => ({ connectionString: url, ssl, ...timeouts }));
  }
  throw new Error(`DB_DRIVER="${kind}" не підтримується (доступно: neon, hyperdrive, postgres)`);
}

// Запоминаем, что запрос не удался (для кэша страниц), не меняя результат: вызывающий код получает тот же промис
function watched(sql: Sql): Sql {
  const w = ((...args: unknown[]) => {
    let r: unknown;
    try {
      r = (sql as unknown as (...a: unknown[]) => unknown)(...args);
    } catch (e) {
      markDbError(); // драйвер мог выбросить ошибку сразу, не вернув промис
      throw e;
    }
    if (r && typeof (r as Promise<unknown>).then === "function") (r as Promise<unknown>).then(undefined, markDbError);
    return r;
  }) as unknown as Sql;
  return Object.assign(w, sql);
}

export function getSql() {
  return watched(createDriver(process.env.DB_DRIVER || "neon"));
}
