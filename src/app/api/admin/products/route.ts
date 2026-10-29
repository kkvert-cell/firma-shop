// Изменения товаров из админки. Форма отправляет поле op: save | create | unlock | delete | visibility
import { NextRequest, NextResponse } from "next/server";
import { apiAdminOk } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { slugify } from "@/lib/prom-feed";
import { ID_RE, PRODUCT_LOCKS, addLocks, oneLine, parseImages, parsePrice, rid, text, uniqueSlug } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const go = (req: NextRequest, path: string, q: string) => NextResponse.redirect(new URL(`${path}?${q}`, req.url), 303);
const err = (req: NextRequest, path: string, msg: string) => go(req, path, `err=${encodeURIComponent(msg)}`);

async function resolveBrand(run: ReturnType<typeof getRunner>, name: string): Promise<string | null> {
  if (!name) return null;
  const slug = slugify(name) || `brand-${rid()}`;
  await run(`INSERT INTO "Brand"(name, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [name, slug]);
  const r = await run(`SELECT id FROM "Brand" WHERE slug = $1 LIMIT 1`, [slug]);
  return r[0] ? String(r[0].id) : null;
}

async function setImages(run: ReturnType<typeof getRunner>, productId: string, urls: string[]) {
  await run(`DELETE FROM "ProductImage" WHERE "productId" = $1`, [productId]);
  if (urls.length) {
    await run(
      `INSERT INTO "ProductImage"("productId", url, "sortOrder")
       SELECT $1::text, u.url, u.ord FROM jsonb_to_recordset($2::jsonb) AS u(url text, ord int)`,
      [productId, JSON.stringify(urls.map((url, ord) => ({ url, ord })))]
    );
  }
}

export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const f = await req.formData();
  const op = String(f.get("op") ?? "");
  const run = getRunner();
  const id = String(f.get("id") ?? "");
  const back = id && ID_RE.test(id) ? `/admin/products/${id}` : "/admin/products";

  try {
    // ---------- Новый товар ----------
    if (op === "create") {
      const name = oneLine(f.get("name"), 250);
      const price = parsePrice(f.get("price"));
      const categoryId = String(f.get("categoryId") ?? "");
      if (name.length < 2) return err(req, "/admin/products/new", "Введите название товара");
      if (price === null || Number.isNaN(price)) return err(req, "/admin/products/new", "Укажите цену числом, например 450");
      if (!ID_RE.test(categoryId) || !(await run(`SELECT 1 AS x FROM "Category" WHERE id = $1`, [categoryId])).length) return err(req, "/admin/products/new", "Выберите категорию");
      const brandId = await resolveBrand(run, oneLine(f.get("brand"), 80));
      const vendor = oneLine(f.get("vendorCode"), 40) || null;
      const slug = `m${rid()}-${await uniqueSlug(run, "Product", name)}`.slice(0, 120);
      const rows = await run(
        `INSERT INTO "Product"(sku, slug, name, description, "categoryId", "brandId", price, "oldPrice", currency, "isAvailable", "vendorCode", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UAH', true, $9, now()) RETURNING id`,
        [`manual-${rid()}${rid()}`, slug, name, text(f.get("description"), 20000) || null, categoryId, brandId, price, parsePrice(f.get("oldPrice")) || null, vendor]
      );
      const newId = String(rows[0].id);
      await setImages(run, newId, parseImages(f.get("images")));
      return go(req, `/admin/products/${newId}`, "ok=created");
    }

    if (!ID_RE.test(id)) return new NextResponse("Bad request", { status: 400 });
    const cur = (
      await run(
        `SELECT p.name, p.description, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice", p."categoryId", p."externalId", p."stockSyncedAt" IS NOT NULL AS exact,
                p."lockedFields", b.name AS brand,
                COALESCE((SELECT string_agg(i.url, E'\\n' ORDER BY i."sortOrder") FROM "ProductImage" i WHERE i."productId" = p.id), '') AS images
         FROM "Product" p LEFT JOIN "Brand" b ON b.id = p."brandId" WHERE p.id = $1`,
        [id]
      )
    )[0];
    if (!cur) return new NextResponse("Not found", { status: 404 });

    // ---------- Сохранить ----------
    if (op === "save") {
      const name = oneLine(f.get("name"), 250);
      const description = text(f.get("description"), 20000);
      const price = parsePrice(f.get("price"));
      const oldPrice = parsePrice(f.get("oldPrice"));
      const categoryId = String(f.get("categoryId") ?? "");
      const brandName = oneLine(f.get("brand"), 80);
      const images = parseImages(f.get("images"));
      if (name.length < 2) return err(req, back, "Название слишком короткое");
      if (price === null || Number.isNaN(price)) return err(req, back, "Цена должна быть числом");
      if (Number.isNaN(oldPrice)) return err(req, back, "Старая цена должна быть числом или пустой");
      if (!ID_RE.test(categoryId) || !(await run(`SELECT 1 AS x FROM "Category" WHERE id = $1`, [categoryId])).length) return err(req, back, "Выберите категорию из списка");

      const norm = (s: unknown) => String(s ?? "").replace(/\r\n/g, "\n").trim();
      const changed: string[] = [];
      if (name !== norm(cur.name)) changed.push("name");
      if (description !== norm(cur.description)) changed.push("description");
      // «цена» защищает и обычную, и старую цену (скидку): иначе Prom затёр бы вручную поставленную скидку
      if (price !== Number(cur.price) || (oldPrice || null) !== (cur.oldPrice ?? null)) changed.push("price");
      if (categoryId !== String(cur.categoryId)) changed.push("category");
      if (brandName !== norm(cur.brand)) changed.push("brand");
      if (images.join("\n") !== norm(cur.images)) changed.push("images");
      // Поля, взятые из Prom, защищаем от перезаписи. У своих товаров (без Prom) защита не нужна.
      const locks = cur.externalId ? addLocks((cur.lockedFields as string[]) ?? [], changed.filter((c) => (PRODUCT_LOCKS as readonly string[]).includes(c))) : [];

      const brandId = changed.includes("brand") ? await resolveBrand(run, brandName) : undefined;
      const visible = f.get("visible") === "on";
      const manualAvail = f.get("available") === "on";
      await run(
        `UPDATE "Product" SET name = $2, description = $3, price = $4, "oldPrice" = $5, "categoryId" = $6,
                "brandId" = CASE WHEN $7::boolean THEN $8 ELSE "brandId" END,
                "vendorCode" = $9, "isHidden" = $10, "seoTitle" = $11, "seoDescription" = $12,
                "isAvailable" = CASE WHEN "stockSyncedAt" IS NULL THEN $13 ELSE "isAvailable" END,
                "lockedFields" = $14::text[], "homeFlags" = $15::text[], "updatedAt" = now()
         WHERE id = $1`,
        [id, name, description || null, price, oldPrice || null, categoryId, changed.includes("brand"), brandId ?? null, oneLine(f.get("vendorCode"), 40) || null,
         !visible, oneLine(f.get("seoTitle"), 200) || null, oneLine(f.get("seoDescription"), 400) || null, manualAvail, locks,
         (["hit", "new", "sale"] as const).filter((k) => f.get(`flag_${k}`) === "on")]
      );
      if (changed.includes("images")) await setImages(run, id, images);
      return go(req, back, "ok=saved");
    }

    // ---------- Вернуть поле из Prom (снять защиту) ----------
    if (op === "unlock") {
      const field = String(f.get("field") ?? "");
      if (!(PRODUCT_LOCKS as readonly string[]).includes(field)) return new NextResponse("Bad request", { status: 400 });
      await run(`UPDATE "Product" SET "lockedFields" = array_remove("lockedFields", $2) WHERE id = $1`, [id, field]);
      return go(req, back, "ok=unlocked");
    }

    // ---------- Показать / скрыть ----------
    if (op === "visibility") {
      await run(`UPDATE "Product" SET "isHidden" = $2, "updatedAt" = now() WHERE id = $1`, [id, f.get("hide") === "1"]);
      return go(req, back, f.get("hide") === "1" ? "ok=hidden" : "ok=shown");
    }

    // ---------- Удалить ----------
    if (op === "delete") {
      // Товар из Prom вернулся бы при следующем обновлении, а у товара с заказами должна сохраниться история — такие только скрываем.
      const used = (await run(`SELECT 1 AS x FROM "OrderItem" WHERE "productId" = $1 LIMIT 1`, [id])).length > 0;
      if (cur.externalId || used) {
        await run(`UPDATE "Product" SET "isHidden" = true, "updatedAt" = now() WHERE id = $1`, [id]);
        return go(req, back, "ok=hidden-instead");
      }
      try {
        await run(`DELETE FROM "ProductImage" WHERE "productId" = $1`, [id]);
        await run(`DELETE FROM "ProductAttributeValue" WHERE "productId" = $1`, [id]);
        await run(`DELETE FROM "Product" WHERE id = $1`, [id]);
        return go(req, "/admin/products", "ok=deleted");
      } catch {
        await run(`UPDATE "Product" SET "isHidden" = true WHERE id = $1`, [id]);
        return go(req, back, "ok=hidden-instead");
      }
    }
  } catch (e) {
    console.error("admin products:", e);
    return err(req, back, "Не удалось сохранить. Попробуйте ещё раз.");
  }
  return new NextResponse("Bad request", { status: 400 });
}
