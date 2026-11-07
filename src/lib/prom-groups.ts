// Власні групи й підгрупи Prom (з YML) як каталог сайту.
//  • групи беруться з <categories> (id, parentId), група товару — з <categoryId> в <offer>;
//  • група визначається за номером Prom, а не за назвою: перейменування не ламає посилання й переклади;
//  • назви перекладаються українською (запасний словник), ручні правки зберігаються (замок «name») і не затираються синхронізацією;
//  • до перемикання (режим «legacy») групи лише підготовлені: на сайті все як раніше. Перемикання — кнопка в адмінці, є відкат.
// Тільки відносні імпорти: файл використовується в cron-воркері.

import type { Run } from "./catalog";
import { getState, setState } from "./sync-state";
import { NAME_FIXES, toUkrainian } from "./ru-uk";
import { slugify } from "./prom-feed";
import { applyVendorCodes, scanYml, type YmlScan } from "./prom-articles";

export type CatalogMode = "legacy" | "groups";

// Групи, які на сайті ховаємо одразу (за рішенням власниці): номер групи Prom або назва
const HIDDEN_GROUP_IDS = new Set(["124506111"]);
const HIDDEN_NAME = /(для\s+взрослых|для\s+дорослих|18\+)/i;
const HOLDER_PATH = "Без групи";

export async function getCatalogMode(run: Run): Promise<CatalogMode> {
  return (await getState(run, "catalog_mode")) === "groups" ? "groups" : "legacy";
}

type Row = Record<string, unknown>;
const n = (rows: Row[], k = "n") => Number(rows[0]?.[k] ?? 0);

export type GroupsResult = { skipped?: string; groups: number; assigned: number; review: number; hiddenByRule: number; goneFromFeed: number };

// ---------- 1. Підтягнути групи й товари з YML ----------
export async function applyGroups(run: Run, scan: YmlScan, mode: CatalogMode): Promise<GroupsResult> {
  const empty = { groups: 0, assigned: 0, review: 0, hiddenByRule: 0, goneFromFeed: 0 };
  if (scan.groups.length === 0) return { ...empty, skipped: "У YML не знайдено груп" };
  if (scan.offers === 0 || scan.offerGroup.size < scan.offers * 0.5) return { ...empty, skipped: "У YML у понад половини товарів немає групи: оновлення пропущено" };

  const existing = await run(`SELECT id, "promId", slug, path, source, name, "lockedFields" FROM "Category"`);
  const usedSlugs = new Set(existing.map((r) => String(r.slug)));
  const foreignPaths = new Set(existing.filter((r) => r.source !== "group").map((r) => String(r.path)));
  const byProm = new Map(existing.filter((r) => r.promId).map((r) => [String(r.promId), r]));

  // дерево
  const byId = new Map(scan.groups.map((g) => [g.id, g]));
  const depthOf = (id: string): number => {
    let d = 0;
    let cur = byId.get(id);
    const seen = new Set<string>();
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
      d++;
      if (d > 8) break;
    }
    return d;
  };
  const sorted = [...scan.groups].sort((a, b) => depthOf(a.id) - depthOf(b.id) || a.order - b.order);

  type Out = { promId: string; parentPromId: string | null; name: string; slug: string; path: string; nameSource: string; nameAuto: boolean; ord: number; hide: boolean; depth: number };
  const outs = new Map<string, Out>();
  const usedPaths = new Set<string>();
  for (const g of sorted) {
    const ex = byProm.get(g.id);
    const locked = ((ex?.lockedFields as string[]) ?? []).includes("name");
    const tr = toUkrainian(g.name);
    const name = locked && ex ? String(ex.name) : tr.name || g.name;
    const parent = g.parentId && outs.has(g.parentId) ? outs.get(g.parentId)! : null;
    let path = parent ? `${parent.path} > ${name}` : name;
    if (usedPaths.has(path) || (!ex && foreignPaths.has(path)) || (ex && String(ex.path) !== path && foreignPaths.has(path))) path = parent ? `${path} (${g.id})` : `${name} [${g.id}]`;
    usedPaths.add(path);
    let slug = ex ? String(ex.slug) : slugify(path.replace(/ > /g, " ")).slice(0, 80).replace(/-+$/, "");
    if (!ex) {
      if (!slug || usedSlugs.has(slug)) slug = `${slug || "grupa"}-${g.id}`;
      usedSlugs.add(slug);
    }
    outs.set(g.id, {
      promId: g.id,
      parentPromId: parent ? parent.promId : null,
      name,
      slug,
      path,
      nameSource: g.name,
      nameAuto: !locked && tr.auto,
      ord: g.order * 10,
      hide: HIDDEN_GROUP_IDS.has(g.id) || HIDDEN_NAME.test(g.name),
      depth: parent ? parent.depth + 1 : 0,
    });
  }

  const active = mode === "groups";
  const maxDepth = Math.max(...[...outs.values()].map((o) => o.depth));
  for (let d = 0; d <= maxDepth; d++) {
    const rows = [...outs.values()].filter((o) => o.depth === d);
    if (!rows.length) continue;
    await run(
      `INSERT INTO "Category"(name, slug, path, "parentId", "isActive", "lockedFields", source, "promId", "nameSource", "nameAuto", "sortOrder", "inFeed")
       SELECT x.name, x.slug, x.path, (SELECT c.id FROM "Category" c WHERE c."promId" = x."parentPromId"),
              ($2::boolean AND NOT x.hide), CASE WHEN x.hide THEN ARRAY['visibility']::text[] ELSE '{}'::text[] END,
              'group', x."promId", x."nameSource", x."nameAuto", x.ord, true
         FROM jsonb_to_recordset($1::jsonb) AS x("promId" text, "parentPromId" text, name text, slug text, path text, "nameSource" text, "nameAuto" boolean, ord int, hide boolean)
       ON CONFLICT ("promId") DO UPDATE SET
         "nameSource" = EXCLUDED."nameSource",
         name = CASE WHEN 'name' = ANY("Category"."lockedFields") THEN "Category".name ELSE EXCLUDED.name END,
         "nameAuto" = CASE WHEN 'name' = ANY("Category"."lockedFields") THEN false ELSE EXCLUDED."nameAuto" END,
         path = EXCLUDED.path,
         "parentId" = EXCLUDED."parentId",
         "sortOrder" = CASE WHEN 'sort' = ANY("Category"."lockedFields") THEN "Category"."sortOrder" ELSE EXCLUDED."sortOrder" END,
         "isActive" = CASE WHEN 'visibility' = ANY("Category"."lockedFields") THEN "Category"."isActive" ELSE $2::boolean END,
         "inFeed" = true`,
      [JSON.stringify(rows), active]
    );
  }

  // групи, яких більше немає в YML
  const gone = n(
    await run(
      `WITH u AS (UPDATE "Category" SET "inFeed" = false, "isActive" = false
                   WHERE source = 'group' AND "promId" <> ALL($1::text[]) AND ("inFeed" OR "isActive") RETURNING 1)
       SELECT count(*)::int AS n FROM u`,
      [[...outs.keys()]]
    )
  );

  // група кожного товару (і перенесення товару в групу, якщо каталог уже на групах)
  const offerRows = [...scan.offerGroup.entries()].map(([o, g]) => ({ o, g }));
  let assigned = 0;
  for (let i = 0; i < offerRows.length; i += 2500) {
    assigned += n(
      await run(
        `WITH m AS (SELECT x.o, c.id AS gid FROM jsonb_to_recordset($1::jsonb) AS x(o text, g text) JOIN "Category" c ON c."promId" = x.g),
              u AS (
                UPDATE "Product" p SET
                  "legacyCategoryId" = CASE WHEN $2::boolean AND p."categoryId" <> m.gid AND p."legacyCategoryId" IS NULL
                                             AND (SELECT c.source FROM "Category" c WHERE c.id = p."categoryId") = 'legacy' THEN p."categoryId" ELSE p."legacyCategoryId" END,
                  "categoryId" = CASE WHEN $2::boolean AND NOT ('category' = ANY(p."lockedFields")) THEN m.gid ELSE p."categoryId" END,
                  "groupId" = m.gid
                 FROM m
                WHERE p."externalId" = m.o
                  AND (p."groupId" IS DISTINCT FROM m.gid OR ($2::boolean AND p."categoryId" <> m.gid AND NOT ('category' = ANY(p."lockedFields"))))
                RETURNING 1)
         SELECT count(*)::int AS n FROM u`,
        [JSON.stringify(offerRows.slice(i, i + 2500)), active]
      )
    );
  }

  // товари прихованих груп (разом з вкладеними) ховаємо; назад їх автоматично не показуємо
  let hiddenByRule = 0;
  if (active) {
    hiddenByRule = n(
      await run(
        `WITH RECURSIVE h AS (
           SELECT id FROM "Category" WHERE source = 'group' AND NOT "isActive" AND "inFeed"
           UNION ALL SELECT c.id FROM "Category" c JOIN h ON c."parentId" = h.id WHERE c.source = 'group'),
         u AS (UPDATE "Product" SET "isHidden" = true, "updatedAt" = now() WHERE "categoryId" IN (SELECT id FROM h) AND NOT "isHidden" RETURNING 1)
         SELECT count(*)::int AS n FROM u`
      )
    );
  }

  await applyNameFixes(run);
  const review = n(await run(`SELECT count(*)::int AS n FROM "Category" WHERE source = 'group' AND "inFeed" AND "nameAuto"`));
  const res: GroupsResult = { groups: outs.size, assigned, review, hiddenByRule, goneFromFeed: gone };
  await setState(run, "groups_last_sync", new Date().toISOString());
  await setState(run, "groups_last_stats", JSON.stringify(res));
  return res;
}

// ---------- 2. Усе разом: артикули + групи з YML ----------
export async function syncYml(run: Run, feedUrl: string) {
  const res = await fetch(feedUrl, { cache: "no-store", headers: { "user-agent": "firma-shop-sync/1.0" } });
  if (!res.ok || !res.body) throw new Error(`YML не відкрився (код ${res.status})`);
  const scan = await scanYml(res.body);
  const codes = await applyVendorCodes(run, scan.codes);
  const mode = await getCatalogMode(run);
  const groups = await applyGroups(run, scan, mode);
  return { offers: scan.offers, ...codes, groups };
}

// ---------- 3. Перемикання каталогу на групи й назад ----------
async function recomputePaths(run: Run) {
  await run(
    `WITH RECURSIVE t AS (
       SELECT id, name AS np FROM "Category" WHERE source = 'group' AND "parentId" IS NULL
       UNION ALL SELECT c.id, t.np || ' > ' || c.name FROM "Category" c JOIN t ON c."parentId" = t.id WHERE c.source = 'group')
     UPDATE "Category" c SET path = t.np FROM t WHERE c.id = t.id AND c.path <> t.np`
  );
}

// Виправлені назви груп (список NAME_FIXES): якщо назва групи ще не змінювалася вручну й збігається зі старим автопереказом,
// ставимо правильну й блокуємо від перезапису. Повертає кількість змінених груп.
export async function applyNameFixes(run: Run): Promise<number> {
  const rows = Object.entries(NAME_FIXES).map(([old, fixed]) => ({ old, fixed }));
  const changed = n(
    await run(
      `WITH u AS (
         UPDATE "Category" c SET name = x.fixed, "nameAuto" = false,
                "lockedFields" = CASE WHEN 'name' = ANY(c."lockedFields") THEN c."lockedFields" ELSE array_append(c."lockedFields", 'name') END
           FROM jsonb_to_recordset($1::jsonb) AS x(old text, fixed text)
          WHERE c.source = 'group' AND c.name = x.old AND NOT ('name' = ANY(c."lockedFields"))
          RETURNING 1)
       SELECT count(*)::int AS n FROM u`,
      [JSON.stringify(rows)]
    )
  );
  if (changed > 0) await recomputePaths(run).catch(() => {});
  return changed;
}

export async function switchToGroups(run: Run): Promise<{ moved: number; redirects: number }> {
  const withGroup = n(await run(`SELECT count(*)::int AS n FROM "Product" WHERE "groupId" IS NOT NULL AND NOT "isHidden"`));
  const total = n(await run(`SELECT count(*)::int AS n FROM "Product" WHERE NOT "isHidden"`));
  if (withGroup === 0 || withGroup < total * 0.5) throw new Error("Групи ще не підтягнулися з YML (менше половини товарів мають групу). Спершу натисніть «Оновити групи з Prom»");

  await run(`INSERT INTO "Category"(name, slug, path, "isActive", source) VALUES ($1, 'bez-grupy', $1, false, 'legacy') ON CONFLICT (path) DO NOTHING`, [HOLDER_PATH]);
  await run(`UPDATE "Category" SET "isActive" = false WHERE source = 'legacy'`);
  await run(`UPDATE "Category" SET "isActive" = ("inFeed" AND NOT ('visibility' = ANY("lockedFields"))) WHERE source = 'group' AND NOT ('visibility' = ANY("lockedFields"))`);
  const moved = n(
    await run(
      `WITH u AS (UPDATE "Product" SET "legacyCategoryId" = COALESCE("legacyCategoryId", "categoryId"), "categoryId" = "groupId"
                   WHERE "groupId" IS NOT NULL AND NOT ('category' = ANY("lockedFields")) AND "categoryId" <> "groupId" RETURNING 1)
       SELECT count(*)::int AS n FROM u`
    )
  );
  // старі адреси категорій → найближча нова група (за кількістю товарів)
  const redirects = n(
    await run(
      `WITH best AS (
         SELECT DISTINCT ON (lc.id) lc.slug AS lslug, gc.slug AS gslug
           FROM "Category" lc
           JOIN "Category" ld ON ld.source = 'legacy' AND (ld.path = lc.path OR left(ld.path, length(lc.path) + 3) = lc.path || ' > ')
           JOIN "Product" p ON p."legacyCategoryId" = ld.id
           JOIN "Category" gc ON gc.id = p."categoryId" AND gc.source = 'group' AND gc."isActive"
          WHERE lc.source = 'legacy'
          GROUP BY lc.id, lc.slug, gc.id, gc.slug
          ORDER BY lc.id, count(*) DESC),
       r AS (
         INSERT INTO "Redirect"(id, "oldPath", "newPath")
         SELECT gen_random_uuid()::text, '/catalog/' || lslug, '/catalog/' || gslug FROM best
         ON CONFLICT ("oldPath") DO UPDATE SET "newPath" = EXCLUDED."newPath"
         RETURNING 1)
       SELECT count(*)::int AS n FROM r`
    )
  );
  // товари прихованих груп
  await run(
    `WITH RECURSIVE h AS (
       SELECT id FROM "Category" WHERE source = 'group' AND NOT "isActive" AND "inFeed"
       UNION ALL SELECT c.id FROM "Category" c JOIN h ON c."parentId" = h.id WHERE c.source = 'group')
     UPDATE "Product" SET "isHidden" = true WHERE "categoryId" IN (SELECT id FROM h) AND NOT "isHidden"`
  );
  await setState(run, "catalog_mode", "groups");
  return { moved, redirects };
}

export async function rollbackToLegacy(run: Run): Promise<{ restored: number }> {
  await run(`UPDATE "Category" SET "isActive" = false WHERE source = 'group'`);
  await run(`UPDATE "Category" SET "isActive" = true WHERE source = 'legacy' AND path <> $1 AND NOT ('visibility' = ANY("lockedFields"))`, [HOLDER_PATH]);
  const restored = n(
    await run(
      `WITH u AS (UPDATE "Product" SET "categoryId" = "legacyCategoryId" WHERE "legacyCategoryId" IS NOT NULL AND NOT ('category' = ANY("lockedFields")) AND "categoryId" <> "legacyCategoryId" RETURNING 1)
       SELECT count(*)::int AS n FROM u`
    )
  );
  await setState(run, "catalog_mode", "legacy");
  return { restored };
}

// ---------- 4. Переклади одним списком: рядки «номер групи | назва» ----------
export async function applyTranslations(run: Run, text: string): Promise<{ updated: number; unknown: string[] }> {
  const pairs: { id: string; name: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s*[|\t=]\s*(.+?)\s*$/.exec(line);
    const nm = m ? m[2].replace(/\s*\/\/.*$/, "").replace(/\s+/g, " ").trim() : "";
    if (m && nm.length >= 2 && nm.length <= 80) pairs.push({ id: m[1], name: nm });
  }
  if (!pairs.length) return { updated: 0, unknown: [] };
  const rows = await run(
    `WITH u AS (
       UPDATE "Category" c SET name = x.name, "nameAuto" = false,
              "lockedFields" = CASE WHEN 'name' = ANY(c."lockedFields") THEN c."lockedFields" ELSE array_append(c."lockedFields", 'name') END
        FROM jsonb_to_recordset($1::jsonb) AS x(id text, name text)
       WHERE c."promId" = x.id AND c.source = 'group' AND c.name IS DISTINCT FROM x.name
       RETURNING c."promId")
     SELECT "promId" FROM u`,
    [JSON.stringify(pairs)]
  );
  await recomputePaths(run).catch(() => {});
  const known = await run(`SELECT "promId" FROM "Category" WHERE "promId" = ANY($1::text[])`, [pairs.map((p) => p.id)]);
  const knownSet = new Set(known.map((r) => String(r.promId)));
  return { updated: rows.length, unknown: pairs.filter((p) => !knownSet.has(p.id)).map((p) => p.id) };
}

// ---------- 5. Стан для адмінки ----------
export async function groupsStatus(run: Run) {
  const [mode, last, stats] = await Promise.all([getCatalogMode(run), getState(run, "groups_last_sync"), getState(run, "groups_last_stats")]);
  const c = await run(
    `SELECT (SELECT count(*) FROM "Category" WHERE source = 'group' AND "inFeed")::int AS groups,
            (SELECT count(*) FROM "Category" WHERE source = 'group' AND "inFeed" AND "nameAuto")::int AS review,
            (SELECT count(*) FROM "Product" WHERE "groupId" IS NOT NULL AND NOT "isHidden")::int AS assigned,
            (SELECT count(*) FROM "Product" WHERE NOT "isHidden")::int AS total`
  );
  return { mode, last, stats: stats ? (JSON.parse(stats) as GroupsResult) : null, counts: c[0] as Record<string, number> };
}
