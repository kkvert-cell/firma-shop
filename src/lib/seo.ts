// SEO: метатеги и структурированные данные (JSON-LD) для поисковиков.
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

export function jsonLd(data: unknown): string {
  // "<" экранируем, чтобы данные не могли закрыть тег <script>
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function productMetadata(p: {
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  image: string | null;
}): Metadata {
  const title = p.seoTitle ?? `${p.name} — купити в ${SITE_NAME}`;
  const description =
    p.seoDescription ?? ((p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 155) || `${p.name}. Доставка по Україні.`);
  const url = `${SITE_URL}/product/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: p.image ? [p.image] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function productJsonLd(p: {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  isAvailable: boolean;
  vendorCode: string | null;
  brand: string | null;
  images: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: (p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 500) || undefined,
    image: p.images.length ? p.images : undefined,
    mpn: p.vendorCode ?? undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${p.slug}`,
      priceCurrency: p.currency,
      price: p.price,
      availability: p.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}
