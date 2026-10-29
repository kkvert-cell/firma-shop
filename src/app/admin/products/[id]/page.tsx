import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { LOCK_LABEL, PRODUCT_LOCKS, allCategories, catLabel, ID_RE } from "@/lib/admin-catalog";
import { thumb } from "@/lib/image";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = {
  saved: "Збережено.",
  created: "Товар створено. Додайте фото й перевірте дані.",
  unlocked: "Захист знято: при наступному оновленні каталогу значення повернеться з Prom (або натисніть «Оновити зараз» в «Інструментах»).",
  hidden: "Товар приховано на сайті.",
  shown: "Товар знову показується на сайті.",
  "hidden-instead": "Товар не можна видалити назавжди (він із Prom або є в замовленнях), тому його приховано на сайті.",
};

export default async function AdminProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!ID_RE.test(id)) notFound();
  const run = getRunner();
  const p = (
    await run(
      `SELECT p.id, p.name, p.slug, p.description, p.price::float8 AS price, p."oldPrice"::float8 AS "oldPrice", p."categoryId", p."vendorCode",
              p."isHidden", p."isAvailable", p."externalId", p."stockQty", p."stockSyncedAt" IS NOT NULL AS exact, p."seoTitle", p."seoDescription",
              p."lockedFields", b.name AS brand
       FROM "Product" p LEFT JOIN "Brand" b ON b.id = p."brandId" WHERE p.id = $1`,
      [id]
    )
  )[0];
  if (!p) notFound();
  const [cats, images] = await Promise.all([allCategories(run), run(`SELECT url FROM "ProductImage" WHERE "productId" = $1 ORDER BY "sortOrder"`, [id])]);
  const locked = ((p.lockedFields as string[]) ?? []).filter((l) => (PRODUCT_LOCKS as readonly string[]).includes(l));
  const urls = images.map((i) => String(i.url));

  return (
    <main className="adm-main">
      <p><Link href="/admin/products">← Усі товари</Link></p>
      <h1 className="heading page-title">Редагування товару</h1>
      {sp.ok && OK[sp.ok] && <p className="notice">{OK[sp.ok]}</p>}
      {sp.err && <p className="notice error">{sp.err}</p>}
      <p className="muted small">
        {p.externalId ? "Товар із Prom: назва, опис, ціна й фото оновлюються автоматично, доки ви їх не змінили тут." : "Власний товар (його не чіпає оновлення з Prom)."}
        {!p.isHidden && <> · <Link href={`/product/${p.slug}`}>Подивитись на сайті</Link></>}
      </p>

      <form action="/api/admin/products" method="post" className="checkout-form adm-form">
        <input type="hidden" name="op" value="save" />
        <input type="hidden" name="id" value={String(p.id)} />
        <label>Назва<input name="name" defaultValue={String(p.name)} maxLength={250} required /></label>
        <label>Опис<textarea name="description" rows={9} defaultValue={String(p.description ?? "")} maxLength={20000} /></label>
        <div className="adm-two">
          <label>Ціна, ₴<input name="price" inputMode="decimal" defaultValue={String(p.price)} required /></label>
          <label>Стара ціна, ₴ (для знижки)<input name="oldPrice" inputMode="decimal" defaultValue={p.oldPrice ? String(p.oldPrice) : ""} /></label>
        </div>
        <label>Категорія
          <select name="categoryId" defaultValue={String(p.categoryId)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </select>
        </label>
        <div className="adm-two">
          <label>Бренд<input name="brand" defaultValue={String(p.brand ?? "")} maxLength={80} /></label>
          <label>Артикул (для зв&apos;язку із залишками KeyCRM)<input name="vendorCode" defaultValue={String(p.vendorCode ?? "")} maxLength={40} /></label>
        </div>
        <label>Фото: за одним посиланням (https) у рядку, перше — головне
          <textarea name="images" rows={5} defaultValue={urls.join("\n")} />
        </label>
        {urls.length > 0 && (
          <div className="adm-thumbs">{urls.slice(0, 12).map((u) => <img key={u} src={thumb(u, 100)} alt="" width={64} height={64} loading="lazy" />)}</div>
        )}
        <label>SEO: заголовок сторінки<input name="seoTitle" defaultValue={String(p.seoTitle ?? "")} maxLength={200} /></label>
        <label>SEO: короткий опис для Google<textarea name="seoDescription" rows={2} defaultValue={String(p.seoDescription ?? "")} maxLength={400} /></label>
        <label className="check"><input type="checkbox" name="visible" defaultChecked={!p.isHidden} /> Показувати на сайті</label>
        {!p.exact && <label className="check"><input type="checkbox" name="available" defaultChecked={Boolean(p.isAvailable)} /> Є в наявності (залишок із KeyCRM для цього товару не підтягується; вкажіть артикул)</label>}
        {Boolean(p.exact) && <p className="muted small">Наявність і залишок ({Number(p.stockQty)} шт.) приходять із KeyCRM автоматично.</p>}
        <button type="submit" className="btn-primary">Зберегти</button>
      </form>

      {locked.length > 0 && (
        <section className="card adm-block">
          <h2 className="heading section-title">Змінено вручну</h2>
          <p className="muted small">Ці поля Prom не перезапише. Щоб повернути значення з Prom, натисніть «Повернути з Prom».</p>
          <ul className="adm-items">
            {locked.map((l) => (
              <li key={l}>
                <span>{LOCK_LABEL[l] ?? l}</span>
                <form action="/api/admin/products" method="post">
                  <input type="hidden" name="op" value="unlock" /><input type="hidden" name="id" value={String(p.id)} /><input type="hidden" name="field" value={l} />
                  <button type="submit" className="link-btn">Повернути з Prom</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card adm-block">
        <h2 className="heading section-title">Видалення</h2>
        <div className="adm-inline">
          <form action="/api/admin/products" method="post">
            <input type="hidden" name="op" value="visibility" /><input type="hidden" name="id" value={String(p.id)} /><input type="hidden" name="hide" value={p.isHidden ? "0" : "1"} />
            <button type="submit" className="btn-secondary">{p.isHidden ? "Показати на сайті" : "Приховати на сайті"}</button>
          </form>
        </div>
        <form action="/api/admin/products" method="post" className="adm-delete">
          <input type="hidden" name="op" value="delete" /><input type="hidden" name="id" value={String(p.id)} />
          <label className="check"><input type="checkbox" required /> Так, видалити цей товар</label>
          <button type="submit" className="btn-secondary">Видалити</button>
          <p className="muted small">{p.externalId ? "Товар із Prom буде лише приховано (інакше він повернувся б при наступному оновленні)." : "Власний товар буде видалено назавжди, якщо його немає в замовленнях; інакше його буде приховано."}</p>
        </form>
      </section>
    </main>
  );
}
