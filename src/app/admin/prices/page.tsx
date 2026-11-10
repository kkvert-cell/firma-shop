import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { BULK_KEYS, ON_SALE, bulkError, changeCond, newPriceSql, parseBulk, scopeWhere } from "@/lib/bulk-price";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function AdminPrices({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const run = getRunner();
  const b = parseBulk((k) => sp[k]);
  const submitted = sp.show === "1";

  const [cats, brands] = await Promise.all([
    run(`SELECT c.id, c.path FROM "Category" c WHERE c."isActive" = true AND c.path IS NOT NULL ORDER BY c.path`),
    run(`SELECT b.id, b.name FROM "Brand" b WHERE EXISTS (SELECT 1 FROM "Product" p WHERE p."brandId" = b.id) ORDER BY b.name`),
  ]);

  const msg =
    sp.ok === "applied" ? `Готово: ціни змінено. Товарів: ${sp.n ?? 0}.` :
    sp.ok === "unlocked" ? `Готово: захист ціни знято. Товарів: ${sp.n ?? 0}. Ціни повернуться з Prom при наступному оновленні.` : null;

  // Перегляд: скільки товарів зміниться й приклади
  let preview: { change: number; sale: number; nonPositive: number; total: number; sample: { name: string; price: number; next: number }[] } | null = null;
  const error = sp.err ?? (submitted ? bulkError(b) : null);
  if (submitted && !error) {
    const p1: unknown[] = [];
    const w = scopeWhere(b, p1, { skipSale: false });
    const n1 = newPriceSql(b, p1);
    const stat = await run(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ${ON_SALE})::int AS sale,
              count(*) FILTER (WHERE NOT ${ON_SALE} AND ${n1} <= 0)::int AS "nonPositive",
              count(*) FILTER (WHERE NOT ${ON_SALE} AND ${changeCond(b, n1)})::int AS change
         FROM "Product" p WHERE ${w}`,
      p1
    );
    const p2: unknown[] = [];
    const w2 = scopeWhere(b, p2, { skipSale: true });
    const n2 = newPriceSql(b, p2);
    const sample = await run(
      `SELECT p.name, p.price::float8 AS price, (${n2})::float8 AS next FROM "Product" p
        WHERE ${w2} AND ${changeCond(b, n2)} ORDER BY p.name LIMIT 8`,
      p2
    );
    preview = {
      total: Number(stat[0]?.total ?? 0),
      sale: Number(stat[0]?.sale ?? 0),
      nonPositive: Number(stat[0]?.nonPositive ?? 0),
      change: Number(stat[0]?.change ?? 0),
      sample: sample.map((r) => ({ name: String(r.name), price: Number(r.price), next: Number(r.next) })),
    };
  }

  const q = new URLSearchParams();
  for (const k of BULK_KEYS) if (sp[k]) q.set(k, String(sp[k]));
  const hidden = BULK_KEYS.filter((k) => sp[k]).map((k) => <input key={k} type="hidden" name={k} value={String(sp[k])} />);

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Масова зміна цін</h1>
      {msg && <p className="notice">{msg}</p>}
      {error && <p className="notice error">{error}</p>}

      <section className="card adm-block">
        <h2 className="heading section-title">1. Кому і як змінити</h2>
        <form method="get" action="/admin/prices" className="checkout-form adm-form adm-prices">
          <input type="hidden" name="show" value="1" />
          <fieldset>
            <legend>Які товари</legend>
            <label className="check"><input type="radio" name="scope" value="all" defaultChecked={b.scope === "all"} /> Усі товари</label>
            <label className="check"><input type="radio" name="scope" value="category" defaultChecked={b.scope === "category"} /> Одна категорія (з усіма підкатегоріями)</label>
            <label>Категорія
              <select name="cat" defaultValue={b.categoryId}>
                <option value="">— вибрати —</option>
                {cats.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.path).replace(/ > /g, " › ")}</option>)}
              </select>
            </label>
            <label>Бренд (необов'язково)
              <select name="brand" defaultValue={b.brandId}>
                <option value="">Усі бренди</option>
                {brands.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" name="stock" value="1" defaultChecked={b.inStock} /> Лише товари в наявності</label>
          </fieldset>

          <fieldset>
            <legend>Що зробити</legend>
            <label className="check"><input type="radio" name="dir" value="up" defaultChecked={b.dir === "up"} /> Підняти ціну</label>
            <label className="check"><input type="radio" name="dir" value="down" defaultChecked={b.dir === "down"} /> Знизити ціну</label>
          </fieldset>

          <fieldset>
            <legend>На скільки</legend>
            <label className="check"><input type="radio" name="mode" value="amount" defaultChecked={b.mode === "amount"} /> На суму, ₴ (точно, без округлення)</label>
            <label className="check"><input type="radio" name="mode" value="percent" defaultChecked={b.mode === "percent"} /> На відсоток, % (результат округлюється вгору до десятків)</label>
            <label>Число<input name="val" inputMode="decimal" defaultValue={sp.val ?? ""} placeholder="наприклад 50 або 10" required /></label>
          </fieldset>

          <button type="submit" className="btn-primary">Показати, що зміниться</button>
        </form>
      </section>

      {preview && (
        <section className="card adm-block">
          <h2 className="heading section-title">2. Перегляд і підтвердження</h2>
          <div className="adm-cards">
            <div className="adm-card"><span className="adm-card-label">Ціна зміниться</span><span className="adm-card-value">{preview.change}</span></div>
            <div className="adm-card"><span className="adm-card-label">Пропущено: діюча знижка</span><span className="adm-card-value">{preview.sale}</span></div>
            {preview.nonPositive > 0 && <div className="adm-card"><span className="adm-card-label">Пропущено: ціна була б 0 або менше</span><span className="adm-card-value warn">{preview.nonPositive}</span></div>}
          </div>
          {preview.sample.length > 0 ? (
            <ul className="adm-list">
              {preview.sample.map((r, i) => (
                <li key={i} className="adm-row">
                  <strong>{r.name}</strong>
                  <span className="adm-row-sub">{formatPrice(r.price)} ₴ → {formatPrice(r.next)} ₴</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">За цими умовами жодна ціна не зміниться.</p>
          )}
          {preview.change > 0 && (
            <>
              <p className="muted">Показано перші 8 товарів. Змінені товари з Prom не отримуватимуть ціну з Prom, доки ви не зніміть захист нижче.</p>
              <p><a href={`/api/admin/prices?${q}`} className="btn-secondary">Завантажити поточні ціни (резервна копія)</a></p>
              <form action="/api/admin/prices" method="post" className="checkout-form adm-form">
                <input type="hidden" name="op" value="apply" />
                <input type="hidden" name="expect" value={preview.change} />
                {hidden}
                <label className="check"><input type="checkbox" name="confirm" value="yes" /> Так, змінити ціни (товарів: {preview.change})</label>
                <button type="submit" className="btn-primary">Змінити ціни</button>
              </form>
            </>
          )}
        </section>
      )}

      <section className="card adm-block">
        <h2 className="heading section-title">Повернути ціни з Prom</h2>
        <p className="muted">Знімає захист ціни у товарів вибраної області (категорія, бренд, наявність беруться з форми вище). Ціна повернеться з Prom при наступному оновленні каталогу.</p>
        <form action="/api/admin/prices" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="unlock" />
          {hidden}
          <label className="check"><input type="checkbox" name="confirm" value="yes" /> Так, зняти захист ціни</label>
          <button type="submit" className="btn-secondary">Зняти захист</button>
        </form>
      </section>
    </main>
  );
}
