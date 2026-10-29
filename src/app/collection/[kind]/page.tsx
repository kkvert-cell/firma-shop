import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import { plural } from "@/lib/site";
import { COLLECTION_DESCRIPTIONS, COLLECTION_KINDS, COLLECTION_TITLES, PER_PAGE, getRunner, listCollection, type CollectionKind } from "@/lib/catalog";

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
  const sp = await searchParams;
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);

  let result: Awaited<ReturnType<typeof listCollection>> | null = null;
  try {
    result = await listCollection(getRunner(), kind, page);
  } catch (err) {
    console.error("Помилка підбірки:", err);
  }

  return (
    <main>
      <Breadcrumbs items={[{ name: COLLECTION_TITLES[kind] }]} />
      <h1 className="heading page-title">{COLLECTION_TITLES[kind]}</h1>
      {!result && <p className="empty-state">Сторінка тимчасово недоступна. Спробуйте за хвилину.</p>}
      {result && (
        <>
          <p className="muted">{result.total} {plural(result.total, ["товар", "товари", "товарів"])}</p>
          {result.items.length > 0 ? (
            <div className="product-grid">{result.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          ) : (
            <p className="empty-state">Тут поки порожньо. Загляньте пізніше або перегляньте <a href="/catalog">каталог</a>.</p>
          )}
          <Pagination basePath={`/collection/${kind}`} query={new URLSearchParams()} page={page} total={result.total} perPage={PER_PAGE} />
        </>
      )}
    </main>
  );
}
