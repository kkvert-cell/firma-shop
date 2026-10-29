import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { allCategories, catLabel } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = { deleted: "Категорію видалено.", created: "Категорію створено." };

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const cats = await allCategories(getRunner());
  return (
    <main className="adm-main">
      <h1 className="heading page-title">Категорії</h1>
      {sp.ok && OK[sp.ok] && <p className="notice">{OK[sp.ok]}</p>}
      {sp.err && <p className="notice error">{sp.err}</p>}

      <section className="card adm-block">
        <h2 className="heading section-title">Додати категорію</h2>
        <form action="/api/admin/categories" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="create" />
          <label>Назва<input name="name" maxLength={80} required /></label>
          <label>Куди додати
            <select name="parentId" defaultValue="">
              <option value="">Головна категорія (верхній рівень)</option>
              {cats.map((c) => <option key={c.id} value={c.id}>Всередину: {catLabel(c)}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary">Додати</button>
        </form>
      </section>

      <p className="muted small">Усього категорій: {cats.length}. Натисніть на категорію, щоб змінити назву й опис, приховати чи видалити її.</p>
      <ul className="adm-list">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/categories/${c.id}`} className="adm-row" style={{ marginLeft: `${Math.min(c.depth, 4) * 14}px` }}>
              <span className="adm-row-main">{c.name}</span>
              <span className="adm-row-sub">товарів напряму: {c.n}</span>
              <span className="adm-chips">
                {!c.isActive && <span className="chip bad">приховано</span>}
                {c.lockedFields.length > 0 && <span className="chip mute">змінено вручну</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
