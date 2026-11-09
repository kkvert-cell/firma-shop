import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import FilterPanel from "@/components/FilterPanel";
import BlackFridayBanner from "@/components/BlackFridayBanner";
import { isBlackFriday } from "@/lib/blackfriday";
import { formatPrice, plural } from "@/lib/site";
import {
  COLLECTION_DESCRIPTIONS, COLLECTION_KINDS, COLLECTION_TITLES, PER_PAGE, SORT_LABELS, getRunner, getFacets, getFilterLabels, listProducts,
  parseListParams, toQuery, type CollectionKind, type ListParams, type SortKey,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const isKind = (k: string): k is CollectionKind => (COLLECTION_KINDS as string[]).includes(k);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  if (!isKind(kind)) return {};
  return { title: COLLECTION_TITLES[kind], description: COLLECTION_DESCRIPTIONS[kind], alternates: { canonical: `/collection/${kind}` } };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  const lp = parseListParams(await searchParams);
  const run = getRunner();
  const scope = { type: "collection", kind } as const;

  let data: { list: Awaited<ReturnType<typeof listProducts>>; facets: Awaited<ReturnType<typeof getFacets>>; labels: Awaited<ReturnType<typeof getFilterLabels>> } | null = null;
  try {
    const [list, facets, labels] = await Promise.all([listProducts(run, scope, lp), getFacets(run, scope), getFilterLabels(run, lp.filters)]);
    data = { list, facets, labels };
  } catch (err) {
    console.error("Помилка підбірки:", err);
  }

  const bf = kind === "sale" && isBlackFriday();
  const basePath = `/collection/${kind}`;
  const hrefWith = (next: ListParams) => {
    const q = toQuery(next).toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <main className={bf ? "bf-on" : undefined}>
      <Breadcrumbs items={[{ name: bf ? "Чорна п'ятниця" : COLLECTION_TITLES[kind] }]} />
      {bf ? <BlackFridayBanner variant="page" /> : <h1 className="heading page-title">{COLLECTION_TITLES[kind]}</h1>}
      {!data && <p className="empty-state">Сторінка тимчасово недоступна. Спробуйте за хвилину.</p>}
      {data && <CollectionBody kind={kind} bf={bf} lp={lp} data={data} basePath={basePath} hrefWith={hrefWith} />}
    </main>
  );
}

function CollectionBody({
  kind, bf, lp, data, basePath, hrefWith,
}: {
  kind: CollectionKind;
  bf: boolean;
  lp: ListParams;
  data: { list: { items: Parameters<typeof ProductCard>[0]["p"][]; total: number }; facets: Awaited<ReturnType<typeof getFacets>>; labels: Awaited<ReturnType<typeof getFilterLabels>> };
  basePath: string;
  hrefWith: (next: ListParams) => string;
}) {
  const { list, facets, labels } = data;

  // Плашки вибраних фільтрів: кожна — посилання, що цей фільтр знімає
  const chips: { label: string; href: string }[] = [];
  const f = lp.filters;
  if (f.inStock) chips.push({ label: "В наявності", href: hrefWith({ ...lp, page: 1, filters: { ...f, inStock: false } }) });
  if (f.priceMin !== null || f.priceMax !== null) {
    chips.push({
      label: f.priceMin !== null && f.priceMax !== null ? `${formatPrice(f.priceMin)}–${formatPrice(f.priceMax)} ₴` : f.priceMin !== null ? `від ${formatPrice(f.priceMin)} ₴` : `до ${formatPrice(f.priceMax!)} ₴`,
      href: hrefWith({ ...lp, page: 1, filters: { ...f, priceMin: null, priceMax: null } }),
    });
  }
  const groupName = (id: string) => facets.groups.find((g) => g.id === id)?.name ?? "Група";
  for (const id of f.categoryIds) chips.push({ label: groupName(id), href: hrefWith({ ...lp, page: 1, filters: { ...f, categoryIds: f.categoryIds.filter((c) => c !== id) } }) });
  for (const id of f.brandIds) chips.push({ label: labels.brands[id] ?? "Бренд", href: hrefWith({ ...lp, page: 1, filters: { ...f, brandIds: f.brandIds.filter((b) => b !== id) } }) });
  for (const [attrId, valueIds] of Object.entries(f.attrs)) {
    for (const vid of valueIds) {
      const rest = valueIds.filter((x) => x !== vid);
      const attrs = { ...f.attrs };
      if (rest.length) attrs[attrId] = rest;
      else delete attrs[attrId];
      const l = labels.values[vid];
      chips.push({ label: l ? `${l.attr}: ${l.value}` : "Фільтр", href: hrefWith({ ...lp, page: 1, filters: { ...f, attrs } }) });
    }
  }

  // Вибрані значення, яких немає серед показаних чекбоксів, зберігаємо прихованими полями форми
  const shownPairs = new Set(facets.attributes.flatMap((a) => a.values.map((v) => `${a.id}:${v.id}`)));
  const hiddenPairs = Object.entries(f.attrs).flatMap(([a, vs]) => vs.map((v) => `${a}:${v}`)).filter((p) => !shownPairs.has(p));
  const shownBrands = new Set(facets.brands.map((b) => b.id));
  const hiddenBrands = f.brandIds.filter((b) => !shownBrands.has(b));
  const shownGroups = new Set(facets.groups.map((g) => g.id));
  const hiddenGroups = f.categoryIds.filter((c) => !shownGroups.has(c));

  const sorts = (Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({ key, href: hrefWith({ ...lp, page: 1, sort: key }) }));
  const pages = Math.max(1, Math.ceil(list.total / PER_PAGE));

  return (
    <>
      <p className="muted">{list.total} {plural(list.total, ["товар", "товари", "товарів"])}</p>
      {kind === "sale" && !bf && (
        <p className="muted small">
          Біля кожного товару вказано, до якої дати діє знижка. Після цієї дати ціна повертається до звичайної. <Link href="/info/akcii">Умови акцій</Link>
        </p>
      )}

      <div className="catalog-layout">
        <aside>
          <FilterPanel activeCount={chips.length}>
            <form method="get" action={basePath} className="filters-form">
              {lp.sort !== "default" && <input type="hidden" name="sort" value={lp.sort} />}
              {hiddenPairs.map((p) => <input key={p} type="hidden" name="f" value={p} />)}
              {hiddenBrands.map((b) => <input key={b} type="hidden" name="brand" value={b} />)}
              {hiddenGroups.map((c) => <input key={c} type="hidden" name="cat" value={c} />)}

              <label className="check">
                <input type="checkbox" name="instock" value="1" defaultChecked={f.inStock} /> Лише в наявності
              </label>

              {facets.groups.length >= 2 && (
                <fieldset>
                  <legend>Група</legend>
                  {facets.groups.map((g) => (
                    <label key={g.id} className="check">
                      <input type="checkbox" name="cat" value={g.id} defaultChecked={f.categoryIds.includes(g.id)} /> {g.name} <span className="n">{g.n}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <fieldset>
                <legend>Ціна, ₴</legend>
                <div className="price-range">
                  <input type="number" name="pmin" inputMode="decimal" min="0" step="any" aria-label="Ціна від" placeholder={facets.price.min !== null ? `від ${formatPrice(facets.price.min)}` : "від"} defaultValue={f.priceMin ?? ""} />
                  <span aria-hidden="true">–</span>
                  <input type="number" name="pmax" inputMode="decimal" min="0" step="any" aria-label="Ціна до" placeholder={facets.price.max !== null ? `до ${formatPrice(facets.price.max)}` : "до"} defaultValue={f.priceMax ?? ""} />
                </div>
              </fieldset>

              {facets.brands.length >= 2 && (
                <fieldset>
                  <legend>Бренд</legend>
                  {facets.brands.map((b) => (
                    <label key={b.id} className="check">
                      <input type="checkbox" name="brand" value={b.id} defaultChecked={f.brandIds.includes(b.id)} /> {b.name} <span className="n">{b.n}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              {facets.attributes.map((a) => (
                <fieldset key={a.id}>
                  <legend>{a.name}{a.unit ? `, ${a.unit}` : ""}</legend>
                  {a.values.map((v) => (
                    <label key={v.id} className="check">
                      <input type="checkbox" name="f" value={`${a.id}:${v.id}`} defaultChecked={f.attrs[a.id]?.includes(v.id)} /> {v.value} <span className="n">{v.n}</span>
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
                  {s.key === "default" && kind === "sale" ? "Більша знижка" : SORT_LABELS[s.key]}
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
            <div className="product-grid">{list.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          ) : (
            <p className="empty-state">
              {list.total > 0 && lp.page > pages ? (
                <>Такої сторінки немає. <Link href={basePath}>На першу сторінку</Link></>
              ) : chips.length > 0 ? (
                <>Нічого не знайдено за вибраними умовами. <Link href={basePath}>Скинути фільтри</Link></>
              ) : (
                <>Тут поки порожньо. Загляньте пізніше або перегляньте <Link href="/catalog">каталог</Link>.</>
              )}
            </p>
          )}

          <Pagination basePath={basePath} query={toQuery(lp)} page={lp.page} total={list.total} perPage={PER_PAGE} />
        </section>
      </div>
    </>
  );
}
