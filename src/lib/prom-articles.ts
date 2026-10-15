// Артикулы товаров из YML-фида Prom (products_feed.xml): <offer id="..."> ... <vendorCode>...</vendorCode>.
// id оффера = номер товара на Проме (externalId у нас), vendorCode = артикул (sku в KeyCRM).
// Фид большой (две языковые версии описаний), поэтому читаем потоком и держим в памяти только "хвост".

import type { Run } from "./catalog";

const TOKEN = /<offer\s[^>]*?\bid="([^"]+)"|<vendorCode>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*?))\s*<\/vendorCode>/g;

const decodeEntities = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&");
const CARRY = 400;

export async function scanVendorCodes(stream: ReadableStream<Uint8Array>): Promise<{ codes: Map<string, string>; offers: number }> {
  const codes = new Map<string, string>();
  let offers = 0;
  let current: string | null = null;
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  const consume = (flush: boolean) => {
    TOKEN.lastIndex = 0;
    let lastEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN.exec(buf))) {
      lastEnd = TOKEN.lastIndex;
      if (m[1] !== undefined) {
        current = m[1];
        offers++;
      } else if (current && !codes.has(current)) {
        const code = decodeEntities((m[2] ?? m[3] ?? "").trim());
        if (code) codes.set(current, code);
      }
    }
    buf = flush ? "" : buf.slice(Math.max(lastEnd, buf.length - CARRY));
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    consume(false);
  }
  buf += decoder.decode();
  consume(true);
  return { codes, offers };
}

export async function applyVendorCodes(run: Run, codes: Map<string, string>): Promise<{ found: number; changed: number }> {
  const rows = [...codes.entries()].map(([id, code]) => ({ id, code }));
  if (!rows.length) return { found: 0, changed: 0 };
  const res = await run(
    `WITH u AS (
       UPDATE "Product" p SET "vendorCode" = x.code, "updatedAt" = now()
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, code text)
       WHERE p."externalId" = x.id AND p."vendorCode" IS DISTINCT FROM x.code
       RETURNING p.id)
     SELECT count(*)::int AS changed FROM u`,
    [JSON.stringify(rows)]
  );
  return { found: rows.length, changed: Number(res[0]?.changed ?? 0) };
}

export async function linkArticles(run: Run, feedUrl: string) {
  const res = await fetch(feedUrl, { cache: "no-store", headers: { "user-agent": "firma-shop-sync/1.0" } });
  if (!res.ok || !res.body) throw new Error(`Фід артикулів не відкрився (код ${res.status})`);
  const { codes, offers } = await scanVendorCodes(res.body);
  const applied = await applyVendorCodes(run, codes);
  return { offers, ...applied };
}
