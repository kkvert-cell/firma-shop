import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { allCategories, catLabel } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const cats = await allCategories(getRunner());
  return (
    <main className="adm-main">
      <p><Link href="/admin/products">← Усі товари</Link></p>
      <h1 className="heading page-title">Новий товар</h1>
      {sp.err && <p className="notice error">{sp.err}</p>}
      <p className="muted small">Такий товар не залежить від Prom. Щоб на сайті показувався залишок із KeyCRM, вкажіть артикул так, як він записаний у KeyCRM. Без артикула товар завжди «в наявності».</p>
      <form action="/api/admin/products" method="post" className="checkout-form adm-form">
        <input type="hidden" name="op" value="create" />
        <label>Назва<input name="name" maxLength={250} required /></label>
        <label>Категорія
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>Оберіть категорію</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </select>
        </label>
        <div className="adm-two">
          <label>Ціна, ₴<input name="price" inputMode="decimal" required /></label>
          <label>Стара ціна, ₴ (необов&apos;язково)<input name="oldPrice" inputMode="decimal" /></label>
        </div>
        <div className="adm-two">
          <label>Артикул (KeyCRM)<input name="vendorCode" maxLength={40} /></label>
          <label>Бренд<input name="brand" maxLength={80} /></label>
        </div>
        <label>Опис<textarea name="description" rows={7} maxLength={20000} /></label>
        <label>Фото: за одним посиланням (https) у рядку
          <textarea name="images" rows={4} />
        </label>
        <button type="submit" className="btn-primary">Створити товар</button>
      </form>
    </main>
  );
}
