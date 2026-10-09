import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getRunner, getTopCategoriesWithChildren } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Каталог товарів", alternates: { canonical: "/catalog" } };

export default async function CatalogIndex() {
  let tops: Awaited<ReturnType<typeof getTopCategoriesWithChildren>> = [];
  try {
    tops = await getTopCategoriesWithChildren(getRunner());
  } catch (err) {
    console.error("Не вдалося завантажити каталог:", err);
  }

  return (
    <main>
      <Breadcrumbs items={[{ name: "Каталог" }]} />
      <h1 className="heading page-title">Каталог товарів</h1>
      {tops.length === 0 && <p className="empty-state">Каталог тимчасово недоступний.</p>}
      <div className="catalog-index">
        {tops.map((t) => (
          <section key={t.id} className="card catalog-index-card">
            <h2 className="heading section-title"><Link href={`/catalog/${t.slug}`}>{t.name}</Link></h2>
            <ul>
              {t.children.map((c) => (
                <li key={c.id}><Link href={`/catalog/${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
