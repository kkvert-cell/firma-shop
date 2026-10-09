import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import FilterPanel from "@/components/FilterPanel";
import { SITE_URL, SITE_NAME, plural } from "@/lib/site";
import { jsonLd, breadcrumbJsonLd } from "@/lib/seo";
import {
  getRunner, loadCategory, getBreadcrumbs, getSubcategories, listProducts, getFacets, getFilterLabels,
  parseListParams, toQuery, hasActiveFilters, PER_PAGE, SORT_LABELS,
  type ListParams, type SortKey,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ category: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  const lp = parseListParams(await searchParams);
  try {
    const cat = await loadCategory(category);
    if (!cat) return { title: "Категорію не знайдено", robots: { index: false } };
    const base = `${SITE_URL}/catalog/${cat.slug}`;
    const filtered = hasActiveFilters(lp) || lp.sort !== "default";
    return {
      title: cat.seoTitle ?? `${cat.name} — купити в ${SITE_NAME}`,
      description: cat.seoDescription ?? `${cat.name}: ціни, фото, характеристики. Доставка по Україні.`,
      alternates: { canonical: lp.page > 1 && !filtered ? `${base}?page=${lp.page}` : base },
      robots: filtered ? { index: false, follow: true } : undefined,
    };
  } catch {
    return { title: "Каталог" };
  }
}

async function loadData(slug: string, lp: ListParams) {
  const cat = await loadCategory(slug);
  if (!cat) return null;
  const run = getRunner();
  const [crumbs, subs, list, facets, labels] = await Promise.all([
    getBreadcrumbs(run, cat.path),
    getSubcategories(run, cat.id),
    listProducts(run, { type: "category", categoryId: cat.id }, lp),
    getFacets(run, cat.id),
    getFilterLabels(run, lp.filters),
  ]);
  return { cat, crumbs, subs, list, facets, labels };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const lp = parseListParams(await searchParams);

  let data;
  try {
    data = await loadData(category, lp);
  } catch (err) {
    console.error("Не вдалося завантажити категорію:", err);
    return (
      <main>
        <p className="empty-state">Каталог тимчасово недоступний. Спробуйте оновити сторінку за хвилину.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { cat, crumbs, subs, list, facets, labels } = data;
  const basePath = `/catalog/${cat.slug}`;
  const hrefWith = (next: ListParams) => {
    const s = toQuery(next).toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // Плашки выбранных фильтров: у каждой — ссылка, которая этот фильтр снимает
  const chips: { label: string; href: string }[] = [];
  if (lp.filters.inStock) chips.push({ label: "В наявності", href: hrefWith({ ...lp, filters: { ...lp.filters, inStock: false } }) });
  for (const id of lp.filters.brandIds) {
    chips.push({
      label: labels.brands[id] ?? "Бренд",
      href: hrefWith({ ...lp, filters: { ...lp.filters, brandIds: lp.filters.brandIds.filter((b) => b !== id) } }),
    });
  }
  for (const [attrId, valueIds] of Object.entries(lp.filters.attrs)) {
    for (const vid of valueIds) {
      const rest = valueIds.filter((x) => x !== vid);
      const attrs = { ...lp.filters.attrs };
      if (rest.length) attrs[attrId] = rest;
      else delete attrs[attrId];
      const l = labels.values[vid];
      chips.push({ label: l ? `${l.attr}: ${l.value}` : "Фільтр", href: hrefWith({ ...lp, filters: { ...lp.filters, attrs } }) });
    }
  }

  // Выбранные значения, которых нет среди показанных чекбоксов, сохраняем скрытыми полями формы
  const shownPairs = new Set(facets.attributes.flatMap((a) => a.values.map((v) => `${a.id}:${v.id}`)));
  const hiddenPairs = Object.entries(lp.filters.attrs).flatMap(([a, vs]) => vs.map((v) => `${a}:${v}`)).filter((p) => !shownPairs.has(p));
  const shownBrands = new Set(facets.brands.map((b) => b.id));
  const hiddenBrands = lp.filters.brandIds.filter((b) => !shownBrands.has(b));

  const sorts = (Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({ key, href: hrefWith({ ...lp, sort: key }) }));
  const pageQuery = toQuery(lp);
  const pages = Math.max(1, Math.ceil(list.total / PER_PAGE));

  const ld = breadcrumbJsonLd([
    { name: "Головна", url: SITE_URL },
    ...crumbs.map((c) => ({ name: c.name, url: `${SITE_URL}/catalog/${c.slug}` })),
  ]);

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Breadcrumbs
        items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : { name: c.name, href: `/catalog/${c.slug}` }))}
      />

      <h1 className="heading page-title">{cat.name}</h1>
      <p className="muted">{list.total} {plural(list.total, ["товар", "товари", "товарів"])}</p>

      {subs.length > 0 && (
        <div className="subcategories">
          {subs.map((s) => (
            <Link key={s.id} href={`/catalog/${s.slug}`} className="chip">
              {s.name} <span className="n">{s.n}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="tick-divider" style={{ margin: "var(--space-4) 0" }} />

      <div className="catalog-layout">
        <aside>
          <FilterPanel activeCount={chips.length}>
            <form method="get" action={basePath} className="filters-form">
              {lp.sort !== "default" && <input type="hidden" name="sort" value={lp.sort} />}
              {hiddenPairs.map((p) => <input key={p} type="hidden" name="f" value={p} />)}
              {hiddenBrands.map((b) => <input key={b} type="hidden" name="brand" value={b} />)}

              <label className="check">
                <input type="checkbox" name="instock" value="1" defaultChecked={lp.filters.inStock} /> Лише в наявності
              </label>

              {facets.brands.length >= 2 && (
                <fieldset>
                  <legend>Бренд</legend>
                  {facets.brands.map((b) => (
                    <label key={b.id} className="check">
                      <input type="checkbox" name="brand" value={b.id} defaultChecked={lp.filters.brandIds.includes(b.id)} /> {b.name} <span className="n">{b.n}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              {facets.attributes.map((a) => (
                <fieldset key={a.id}>
                  <legend>{a.name}{a.unit ? `, ${a.unit}` : ""}</legend>
                  {a.values.map((v) => (
                    <label key={v.id} className="check">
                      <input type="checkbox" name="f" value={`${a.id}:${v.id}`} defaultChecked={lp.filters.attrs[a.id]?.includes(v.id)} /> {v.value} <span className="n">{v.n}</span>
                    </label>
                  ))}
                </fieldset>
              ))}

              <div className="filters-actions">
                <button type="submit" className="btn-primary">Застосувати</button>
                {chips.length > 0 && <Link href={lp.sort !== "default" ? `${basePath}?sort=${lp.sort}` : basePath}>Скинути</Link>}
              </div>
            </form>
          </FilterPanel>
        </aside>

        <section>
          <div className="toolbar">
            <div className="sort-links">
              <span className="muted">Сортування:</span>
              {sorts.map((s) => (
                <Link key={s.key} href={s.href} className={s.key === lp.sort ? "current" : undefined}>
                  {SORT_LABELS[s.key]}
                </Link>
              ))}
            </div>
          </div>

          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((c, i) => (
                <Link key={i} href={c.href} className="chip chip-active" title="Прибрати фільтр">
                  {c.label} <span aria-hidden>✕</span>
                </Link>
              ))}
            </div>
          )}

          {list.items.length > 0 ? (
            <div className="product-grid">
              {list.items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          ) : (
            <p className="empty-state">
              {list.total > 0 && lp.page > pages ? (
                <>Такої сторінки немає. <Link href={basePath}>На першу сторінку</Link></>
              ) : (
                <>Нічого не знайдено за вибраними умовами. <Link href={basePath}>Скинути фільтри</Link></>
              )}
            </p>
          )}

          <Pagination basePath={basePath} query={pageQuery} page={lp.page} total={list.total} perPage={PER_PAGE} />

          {cat.description && <div className="seo-text">{cat.description}</div>}
        </section>
      </div>
    </main>
  );
}
