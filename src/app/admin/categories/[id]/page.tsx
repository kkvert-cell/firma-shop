import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { ID_RE, LOCK_LABEL, allCategories } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = {
  saved: "Збережено.",
  created: "Категорію створено. Додайте опис або переходьте до товарів.",
  unlocked: "Захист знято: при наступному оновленні каталогу значення повернеться з Prom.",
  "products-hidden": "Товари категорії приховано.",
  "products-shown": "Товари категорії знову показуються.",
};

export default async function AdminCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; n?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!ID_RE.test(id)) notFound();
  const run = getRunner();
  const c = (await run(`SELECT id, name, slug, path, description, "seoTitle", "seoDescription", "sortOrder", "isActive", "lockedFields", "parentId" FROM "Category" WHERE id = $1`, [id]))[0];
  if (!c) notFound();
  const all = await allCategories(run);
  const me = all.find((x) => x.id === id);
  const kids = all.filter((x) => x.parentId === id).length;
  const stats = (
    await run(
      `WITH RECURSIVE tree AS (SELECT id FROM "Category" WHERE id = $1 UNION ALL SELECT c.id FROM "Category" c JOIN tree t ON c."parentId" = t.id)
       SELECT count(*)::int AS total, count(*) FILTER (WHERE p."isHidden")::int AS hidden FROM "Product" p WHERE p."categoryId" IN (SELECT id FROM tree)`,
      [id]
    )
  )[0];
  const locked = ((c.lockedFields as string[]) ?? []).filter((l) => l === "name" || l === "visibility");

  return (
    <main className="adm-main">
      <p><Link href="/admin/categories">← Усі категорії</Link></p>
      <h1 className="heading page-title">Категорія</h1>
      {sp.ok && OK[sp.ok] && <p className="notice">{OK[sp.ok]}{sp.n ? ` (товарів: ${sp.n})` : ""}</p>}
      {sp.err && <p className="notice error">{sp.err}</p>}
      <p className="muted small">Шлях: {String(c.path)} · адреса на сайті не змінюється при перейменуванні: <Link href={`/catalog/${c.slug}`}>/catalog/{String(c.slug)}</Link></p>

      <form action="/api/admin/categories" method="post" className="checkout-form adm-form">
        <input type="hidden" name="op" value="save" /><input type="hidden" name="id" value={String(c.id)} />
        <label>Назва<input name="name" defaultValue={String(c.name)} maxLength={80} required /></label>
        <label>Опис категорії (показується на сайті для покупців і Google)<textarea name="description" rows={6} defaultValue={String(c.description ?? "")} maxLength={20000} /></label>
        <label>SEO: заголовок сторінки<input name="seoTitle" defaultValue={String(c.seoTitle ?? "")} maxLength={200} /></label>
        <label>SEO: короткий опис для Google<textarea name="seoDescription" rows={2} defaultValue={String(c.seoDescription ?? "")} maxLength={400} /></label>
        <label>Порядок у меню (менше число — вище)<input name="sortOrder" inputMode="numeric" defaultValue={String(c.sortOrder ?? 0)} /></label>
        <label className="check"><input type="checkbox" name="visible" defaultChecked={Boolean(c.isActive)} /> Показувати категорію на сайті</label>
        <button type="submit" className="btn-primary">Зберегти</button>
      </form>

      {locked.length > 0 && (
        <section className="card adm-block">
          <h2 className="heading section-title">Змінено вручну</h2>
          <p className="muted small">Ці поля Prom не перезапише.</p>
          <ul className="adm-items">
            {locked.map((l) => (
              <li key={l}>
                <span>{LOCK_LABEL[l] ?? l}</span>
                <form action="/api/admin/categories" method="post">
                  <input type="hidden" name="op" value="unlock" /><input type="hidden" name="id" value={String(c.id)} /><input type="hidden" name="field" value={l} />
                  <button type="submit" className="link-btn">Повернути з Prom</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card adm-block">
        <h2 className="heading section-title">Додати підкатегорію</h2>
        <form action="/api/admin/categories" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="create" /><input type="hidden" name="parentId" value={String(c.id)} />
          <label>Назва підкатегорії<input name="name" maxLength={80} required /></label>
          <button type="submit" className="btn-secondary">Додати</button>
        </form>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Товари категорії</h2>
        <p className="muted small">У цій категорії та її підкатегоріях: {Number(stats?.total ?? 0)} товарів, із них прихованих: {Number(stats?.hidden ?? 0)}. «Приховати категорію» прибирає її з меню, але самі товари ще можна знайти пошуком. Щоб прибрати й товари, використайте кнопки нижче.</p>
        <div className="adm-inline">
          <form action="/api/admin/categories" method="post"><input type="hidden" name="op" value="products" /><input type="hidden" name="id" value={String(c.id)} /><input type="hidden" name="hide" value="1" /><button type="submit" className="btn-secondary">Приховати всі товари</button></form>
          <form action="/api/admin/categories" method="post"><input type="hidden" name="op" value="products" /><input type="hidden" name="id" value={String(c.id)} /><input type="hidden" name="hide" value="0" /><button type="submit" className="btn-secondary">Показати всі товари</button></form>
        </div>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Видалення</h2>
        <p className="muted small">Видалити можна лише порожню категорію (без товарів і підкатегорій). Підкатегорій: {kids}, товарів напряму: {me?.n ?? 0}. Інакше її можна просто приховати галочкою вище.</p>
        <form action="/api/admin/categories" method="post" className="adm-delete">
          <input type="hidden" name="op" value="delete" /><input type="hidden" name="id" value={String(c.id)} />
          <label className="check"><input type="checkbox" required /> Так, видалити цю категорію</label>
          <button type="submit" className="btn-secondary">Видалити</button>
        </form>
      </section>
    </main>
  );
}
