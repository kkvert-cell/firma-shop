import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import Icon from "@/components/Icon";
import RichText from "@/components/RichText";
import AddToCart from "@/components/AddToCart";
import { SITE_NAME, SITE_URL, SHOP_PHONE, SHOP_PHONE_TEXT, formatPrice } from "@/lib/site";
import { jsonLd, productJsonLd, productMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { loadProduct } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ dbg?: string }> };

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

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const debugText = (await searchParams)?.dbg === "1";

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

          {discount > 0 && p.saleUntil && (
            <p className="sale-period">
              Акційна ціна діє {p.saleFrom ? `з ${p.saleFrom} ` : ""}до {p.saleUntil} включно (інтернет-магазин {SITE_NAME}). Попередня ціна — найнижча за останні 30 днів.{" "}
              <Link href="/info/akcii">Умови акцій</Link>
            </p>
          )}

          <p className={p.isAvailable ? "stock-in" : "stock-out"}>
            {!p.isAvailable
              ? "Немає в наявності"
              : p.stockExact && p.stockQty > 0 && p.stockQty <= 5
                ? `Залишилось ${p.stockQty} шт.`
                : "В наявності"}
          </p>

          <div className="card buy-box">
            <AddToCart
              product={{
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: imageUrls[0] ?? null,
                available: p.isAvailable,
                maxQty: p.stockExact && p.stockQty > 0 ? p.stockQty : 99,
              }}
            />
            <ul className="benefits">
              <li><Icon name="truck" /><span><b>Доставка по Україні</b>Нова пошта або Укрпошта</span></li>
              <li><Icon name="card" /><span><b>Оплата</b>При отриманні або за реквізитами</span></li>
              <li><Icon name="return" /><span><b>Повернення</b>14 днів за законом</span></li>
              <li><Icon name="phone" /><span><b>Консультація</b><a href={`tel:${SHOP_PHONE}`} className="data">{SHOP_PHONE_TEXT}</a></span></li>
            </ul>
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
          <RichText text={p.description} />
          {debugText && (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
              {Array.from(p.description.slice(0, 1500))
                .map((c) => (/[\p{L}\p{N}]/u.test(c) || (c >= " " && c <= "~") ? c : `[U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}]`))
                .join("")}
            </pre>
          )}
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
