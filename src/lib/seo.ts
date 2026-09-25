// ============================================================================
// SEO для страницы товара: метатеги + JSON-LD (Product/Offer schema).
// generateMetadata — специальная функция Next.js, которая формирует
// <title>, <meta description>, OpenGraph и canonical URL автоматически
// на основе данных товара из БД.
// ============================================================================

import type { Metadata } from "next";

type ProductSeoData = {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  available: boolean;
  brand: string;
  images: string[];
  seoTitle?: string | null;
};

export function generateProductMetadata(product: ProductSeoData): Metadata {
  const title = product.seoTitle ?? `${product.name} — купити в Firma`;
  const description =
    product.description.slice(0, 155) || `${product.name}. Доставка по Україні, гарантія, оплата на вибір.`;

  return {
    title,
    description,
    alternates: { canonical: `https://firma-shop.ua/product/${product.slug}` },
    openGraph: {
      title,
      description,
      images: product.images,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

// JSON-LD — структурированные данные для Google (показывают цену/наличие
// прямо в выдаче поиска). Рендерится как <script type="application/ld+json">
// внутри страницы товара.
export function productJsonLd(product: ProductSeoData) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: product.price,
      availability: product.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://firma-shop.ua/product/${product.slug}`,
    },
  };
}

// BreadcrumbList — аналогично, для хлебных крошек в выдаче поиска
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
