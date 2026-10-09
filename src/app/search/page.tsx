import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import { plural } from "@/lib/site";
import { getRunner, listProducts, parseListParams, toQuery, PER_PAGE, SORT_LABELS, type SortKey } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SP> };

const queryOf = (sp: SP) => {
  const v = sp.q;
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 100);
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = queryOf(await searchParams);
  return { title: q ? `Пошук: ${q}` : "Пошук", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = queryOf(sp);
  const lp = parseListParams(sp);
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 6);

  if (tokens.length === 0) {
    return (
      <main>
        <Breadcrumbs items={[{ name: "Пошук" }]} />
        <h1 className="heading page-title">Пошук</h1>
        <p className="empty-state">Введіть назву або артикул товару у рядок пошуку вгорі сторінки.</p>
      </main>
    );
  }

  let result;
  try {
    result = await listProducts(getRunner(), { type: "search", tokens }, lp);
  } catch (err) {
    console.error("Помилка пошуку:", err);
    return (
      <main>
        <p className="empty-state">Пошук тимчасово недоступний. Спробуйте за хвилину.</p>
      </main>
    );
  }

  const hrefSort = (sort: SortKey) => {
    const out = new URLSearchParams({ q });
    toQuery({ ...lp, sort }).forEach((v, k) => out.append(k, v));
    return `/search?${out.toString()}`;
  };
  const pageQuery = new URLSearchParams({ q });
  toQuery(lp).forEach((v, k) => pageQuery.append(k, v));

  return (
    <main>
      <Breadcrumbs items={[{ name: "Пошук" }]} />
      <h1 className="heading page-title">Пошук: «{q}»</h1>
      <p className="muted">{result.total} {plural(result.total, ["товар", "товари", "товарів"])}</p>

      <div className="toolbar">
        <div className="sort-links">
          <span className="muted">Сортування:</span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <Link key={key} href={hrefSort(key)} className={key === lp.sort ? "current" : undefined}>
              {SORT_LABELS[key]}
            </Link>
          ))}
        </div>
      </div>

      {result.items.length > 0 ? (
        <div className="product-grid">
          {result.items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : (
        <p className="empty-state">
          За запитом «{q}» нічого не знайдено. Спробуйте коротше слово або артикул, або перегляньте <Link href="/catalog">усі категорії</Link>.
        </p>
      )}

      <Pagination basePath="/search" query={pageQuery} page={lp.page} total={result.total} perPage={PER_PAGE} />
    </main>
  );
}
