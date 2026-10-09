import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import { SITE_URL, SHOP_PHONE, SHOP_PHONE_TEXT, formatPrice } from "@/lib/site";
import { jsonLd, productJsonLd, productMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { loadProduct } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await loadProduct(slug);
    if (!data) return { title: "Товар не знайдено", robots: { index: false } };
    return productMetadata({ ...data.product, image: data.images[0]?.url ?? null });
  } catch {
    return { title: "Товар" };
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  let data;
  try {
    data = await loadProduct(slug);
  } catch (err) {
    console.error("Не вдалося завантажити товар:", err);
    return (
      <main>
        <p className="empty-state">Сторінка тимчасово недоступна. Спробуйте оновити її за хвилину.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { product: p, images, attrs, related, crumbs } = data;
  const imageUrls = images.map((i) => i.url);
  const discount = p.oldPrice && p.oldPrice > p.price && p.price > 0 ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  const ld = [
    productJsonLd({ ...p, images: imageUrls }),
    breadcrumbJsonLd([
      { name: "Головна", url: SITE_URL },
      ...crumbs.map((c) => ({ name: c.name, url: `${SITE_URL}/catalog/${c.slug}` })),
      { name: p.name, url: `${SITE_URL}/product/${p.slug}` },
    ]),
  ];

  return (
    <main>
      {ld.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(item) }} />
      ))}
      <Breadcrumbs items={[...crumbs.map((c) => ({ name: c.name, href: `/catalog/${c.slug}` })), { name: p.name }]} />

      <div className="pdp">
        <ProductGallery images={imageUrls} name={p.name} />

        <div>
          <h1 className="heading page-title">{p.name}</h1>
          <div className="data muted pdp-meta">
            {p.vendorCode && <span>Арт. {p.vendorCode}</span>}
            {p.brand && <span>{p.brand}</span>}
          </div>

          <div className="pdp-price">
            {p.price > 0 ? (
              <>
                <span className="price data pdp-price-main">{formatPrice(p.price)} ₴</span>
                {discount > 0 && p.oldPrice && (
                  <>
                    <span className="old-price data">{formatPrice(p.oldPrice)} ₴</span>
                    <span className="badge-mark pdp-discount">−{discount}%</span>
                  </>
                )}
              </>
            ) : (
              <span className="stock-out">Ціну уточнюйте</span>
            )}
          </div>

          <p className={p.isAvailable ? "stock-in" : "stock-out"}>{p.isAvailable ? "В наявності" : "Немає в наявності"}</p>

          <div className="card buy-box">
            <strong>Замовити</strong>
            <p className="muted">Оформлення замовлення на сайті з&apos;явиться найближчим часом. Поки що зателефонуйте — оформимо замовлення за кілька хвилин.</p>
            <a href={`tel:${SHOP_PHONE}`} className="btn-primary call-btn">{SHOP_PHONE_TEXT}</a>
          </div>

          {attrs.length > 0 && (
            <>
              <h2 className="heading section-title">Характеристики</h2>
              <table className="specs">
                <tbody>
                  {attrs.map((a, i) => (
                    <tr key={i}>
                      <td className="muted">{a.name}</td>
                      <td className="data">{a.value}{a.unit ? ` ${a.unit}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {p.description && (
        <section className="pdp-description">
          <h2 className="heading section-title">Опис</h2>
          <p>{p.description}</p>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <div className="tick-divider" style={{ margin: "var(--space-8) 0 var(--space-4)" }} />
          <h2 className="heading section-title">Схожі товари</h2>
          <div className="product-grid">
            {related.map((r) => <ProductCard key={r.id} p={r} />)}
          </div>
        </section>
      )}
    </main>
  );
}
