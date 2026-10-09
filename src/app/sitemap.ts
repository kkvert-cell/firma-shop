import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getRunner, getSitemapData } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "weekly", priority: 0.8 },
  ];
  try {
    const { categories, products } = await getSitemapData(getRunner());
    for (const slug of categories) entries.push({ url: `${SITE_URL}/catalog/${slug}`, changeFrequency: "daily", priority: 0.7 });
    for (const p of products) entries.push({ url: `${SITE_URL}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily", priority: 0.6 });
  } catch (err) {
    console.error("Не вдалося зібрати карту сайту:", err);
  }
  return entries;
}
