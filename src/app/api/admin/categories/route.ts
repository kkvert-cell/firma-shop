// Изменения категорий из админки. Форма отправляет поле op: create | save | unlock | delete | products
import { NextRequest, NextResponse } from "next/server";
import { apiAdminOk } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { ID_RE, addLocks, oneLine, text, uniqueSlug } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const go = (req: NextRequest, path: string, q: string) => NextResponse.redirect(new URL(`${path}?${q}`, req.url), 303);
const err = (req: NextRequest, path: string, msg: string) => go(req, path, `err=${encodeURIComponent(msg)}`);

export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const f = await req.formData();
  const op = String(f.get("op") ?? "");
  const run = getRunner();
  const id = String(f.get("id") ?? "");
  const back = id && ID_RE.test(id) ? `/admin/categories/${id}` : "/admin/categories";

  try {
    // ---------- Новая категория ----------
    if (op === "create") {
      const name = oneLine(f.get("name"), 80);
      const parentId = String(f.get("parentId") ?? "");
      if (name.length < 2) return err(req, "/admin/categories", "Введите название категории");
      let parentPath: string | null = null;
      let parent: string | null = null;
      if (parentId) {
        const p = (await run(`SELECT id, path FROM "Category" WHERE id = $1`, [parentId]))[0];
        if (!ID_RE.test(parentId) || !p) return err(req, "/admin/categories", "Родительская категория не найдена");
        parent = String(p.id);
        parentPath = String(p.path);
      }
      // path — внутренний «адрес» категории в дереве; делаем уникальным
      let path = parentPath ? `${parentPath} > ${name}` : name;
      for (let i = 2; (await run(`SELECT 1 AS x FROM "Category" WHERE path = $1`, [path])).length && i < 20; i++) path = `${parentPath ? parentPath + " > " : ""}${name} (${i})`;
      const slug = await uniqueSlug(run, "Category", path.replace(/ > /g, " "));
      const rows = await run(
        `INSERT INTO "Category"(name, slug, path, "parentId", "isActive") VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [name, slug, path, parent]
      );
      return go(req, `/admin/categories/${rows[0].id}`, "ok=created");
    }

    if (!ID_RE.test(id)) return new NextResponse("Bad request", { status: 400 });
    const cur = (await run(`SELECT name, "isActive", "lockedFields" FROM "Category" WHERE id = $1`, [id]))[0];
    if (!cur) return new NextResponse("Not found", { status: 404 });

    // ---------- Сохранить ----------
    if (op === "save") {
      const name = oneLine(f.get("name"), 80);
      if (name.length < 2) return err(req, back, "Название слишком короткое");
      const visible = f.get("visible") === "on";
      const changed: string[] = [];
      if (name !== String(cur.name)) changed.push("name");
      if (visible !== Boolean(cur.isActive)) changed.push("visibility");
      const locks = addLocks((cur.lockedFields as string[]) ?? [], changed);
      const sort = Number.parseInt(String(f.get("sortOrder") ?? "0"), 10);
      await run(
        `UPDATE "Category" SET name = $2, "isActive" = $3, description = $4, "seoTitle" = $5, "seoDescription" = $6, "sortOrder" = $7, "lockedFields" = $8::text[] WHERE id = $1`,
        [id, name, visible, text(f.get("description"), 20000) || null, oneLine(f.get("seoTitle"), 200) || null, oneLine(f.get("seoDescription"), 400) || null, Number.isFinite(sort) ? Math.max(-9999, Math.min(9999, sort)) : 0, locks]
      );
      return go(req, back, "ok=saved");
    }

    // ---------- Вернуть из Prom ----------
    if (op === "unlock") {
      const field = String(f.get("field") ?? "");
      if (!["name", "visibility"].includes(field)) return new NextResponse("Bad request", { status: 400 });
      await run(`UPDATE "Category" SET "lockedFields" = array_remove("lockedFields", $2) WHERE id = $1`, [id, field]);
      return go(req, back, "ok=unlocked");
    }

    // ---------- Скрыть / показать все товары категории (вместе с подкатегориями) ----------
    if (op === "products") {
      const hide = f.get("hide") === "1";
      const rows = await run(
        `WITH RECURSIVE tree AS (SELECT id FROM "Category" WHERE id = $1 UNION ALL SELECT c.id FROM "Category" c JOIN tree t ON c."parentId" = t.id),
              u AS (UPDATE "Product" SET "isHidden" = $2, "updatedAt" = now() WHERE "categoryId" IN (SELECT id FROM tree) AND "isHidden" <> $2 RETURNING 1)
         SELECT count(*)::int AS n FROM u`,
        [id, hide]
      );
      return go(req, back, `ok=${hide ? "products-hidden" : "products-shown"}&n=${rows[0]?.n ?? 0}`);
    }

    // ---------- Удалить (только пустую) ----------
    if (op === "delete") {
      const kids = Number((await run(`SELECT count(*)::int AS n FROM "Category" WHERE "parentId" = $1`, [id]))[0].n);
      const prods = Number((await run(`SELECT count(*)::int AS n FROM "Product" WHERE "categoryId" = $1`, [id]))[0].n);
      if (kids > 0) return err(req, back, `Нельзя удалить: внутри ${kids} подкатегорий. Сначала удалите или скройте их.`);
      if (prods > 0) return err(req, back, `Нельзя удалить: в категории ${prods} товаров. Перенесите их в другую категорию или скройте категорию.`);
      await run(`DELETE FROM "CategoryAttribute" WHERE "categoryId" = $1`, [id]).catch(() => {});
      await run(`DELETE FROM "Category" WHERE id = $1`, [id]);
      return go(req, "/admin/categories", "ok=deleted");
    }
  } catch (e) {
    console.error("admin categories:", e);
    return err(req, back, "Не удалось сохранить. Попробуйте ещё раз.");
  }
  return new NextResponse("Bad request", { status: 400 });
}
