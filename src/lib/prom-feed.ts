// Разбор фида Google Merchant Center (RSS 2.0), который отдаёт Prom.ua.
// Регулярные выражения вместо XML-парсера: файл большой, структура простая,
// а в Cloudflare Workers нет браузерного DOMParser.

export type FeedItem = {
  externalId: string; // id товара на Проме
  slug: string; // p1322527284-vysechnye-nozhnitsy-metallu (как в старых ссылках Прома)
  name: string;
  description: string;
  sourceUrl: string;
  images: string[];
  available: boolean; // "in stock" / "out of stock" — точного количества в этом фиде нет
  price: number | null;
  currency: string;
  categoryPath: string[]; // ["Інструменти", "Електроінструмент", "Дрилі, шуруповерти"]
  brand: string | null;
  vendorCode: string | null; // артикул (g:mpn) — по нему сверяемся с KeyCRM
  details: { name: string; value: string }[]; // характеристики товара
};

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye", ж: "zh", з: "z",
  и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: "yu", я: "ya", ы: "y", э: "e", ъ: "", ё: "yo",
};

export function slugify(input: string): string {
  const latin = input
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function decode(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function firstTag(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<g:${tag}>([\\s\\S]*?)</g:${tag}>`));
  return m ? decode(m[1]) : null;
}


function allTags(item: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<g:${tag}>([\\s\\S]*?)</g:${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(item))) out.push(decode(m[1]));
  return out;
}

const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function splitItems(xml: string): string[] {
  return xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
}

export function parseItem(raw: string): FeedItem | null {
  const externalId = firstTag(raw, "id");
  const name = firstTag(raw, "title");
  if (!externalId || !name) return null;

  const link = firstTag(raw, "link") ?? "";
  const linkMatch = link.match(/\/p(\d+)-([^./?]+)\.html/);
  const slug = linkMatch ? `p${linkMatch[1]}-${linkMatch[2]}` : `p${externalId}`;

  const mainImage = firstTag(raw, "image_link");
  const images = [...(mainImage ? [mainImage] : []), ...allTags(raw, "additional_image_link")];
  const uniqueImages = [...new Set(images)];

  const priceRaw = firstTag(raw, "price") ?? "";
  const priceMatch = priceRaw.match(/([\d.,]+)\s*([A-Z]{3})?/);
  const price = priceMatch ? Number(priceMatch[1].replace(",", ".")) : null;

  const categoryPath = (firstTag(raw, "product_type") ?? "")
    .split(">")
    .map((p) => upperFirst(p.trim()))
    .filter(Boolean);

  const brandRaw = firstTag(raw, "brand");
  const brand = brandRaw && brandRaw.toLowerCase() !== "без бренду" ? brandRaw : null;
  const vendorCode = firstTag(raw, "mpn");

  const details: { name: string; value: string }[] = [];
  const detailRe =
    /<g:product_detail>\s*<g:attribute_name>([\s\S]*?)<\/g:attribute_name>\s*<g:attribute_value>([\s\S]*?)<\/g:attribute_value>\s*<\/g:product_detail>/g;
  let d: RegExpExecArray | null;
  while ((d = detailRe.exec(raw))) {
    const n = decode(d[1]);
    const v = decode(d[2]);
    if (n && v) details.push({ name: n, value: v });
  }

  return {
    externalId,
    slug,
    name,
    description: firstTag(raw, "description") ?? "",
    sourceUrl: link.replace(/\?.*$/, ""),
    images: uniqueImages,
    available: (firstTag(raw, "availability") ?? "").toLowerCase() === "in stock",
    price: price !== null && Number.isFinite(price) ? price : null,
    currency: priceMatch?.[2] ?? "UAH",
    categoryPath: categoryPath.length ? categoryPath : ["Інше"],
    brand,
    vendorCode,
    details,
  };
}
