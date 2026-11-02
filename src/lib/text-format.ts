// Красивое оформление описаний: абзацы, списки, подзаголовки и таблица характеристик.
// Исходный текст — обычный (из Prom или набранный в админке). Правила простые и описаны подсказкой под полем описания.

export type Block =
  | { t: "p"; lines: string[] }
  | { t: "h"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "dl"; rows: [string, string][] };

const NAMED: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", deg: "°", times: "×", plusmn: "±", micro: "µ", bull: "•" };
const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);

const TAGS = "p|div|br|ul|ol|li|h[1-6]|span|strong|b|em|i|u|a|font|table|tbody|thead|tr|td|th|section|article|img|hr";

// Превращает описание с HTML-разметкой (если оно попало из Prom) в обычный текст с переводами строк
export function normalizeDescription(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/\r\n?/g, "\n");
  s = decodeEntities(s);
  if (new RegExp(`</?(?:${TAGS})\\b[^>]*>`, "i").test(s)) {
    s = s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|h[1-6]|ul|ol|table|section|article)\s*>/gi, "\n\n")
      .replace(/<(?:h[1-6])\b[^>]*>/gi, "\n\n")
      .replace(/<(?:ul|ol)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/li\s*>/gi, "")
      .replace(/<\/tr\s*>/gi, "\n")
      .replace(/<\/t[dh]\s*>/gi, ": ")
      .replace(new RegExp(`</?(?:${TAGS})\\b[^>]*>`, "gi"), "");
    s = decodeEntities(s);
  }
  return s
    .replace(/[ \t\u00a0]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BULLET = /^(?:[•·*▪●◦–—-])\s+(.*)$/;
const NUMBERED = /^(\d{1,2})[.)]\s+(.*)$/;
const KV = /^([^:\n]{2,40}):\s+(\S.{0,119})$/;

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=[А-ЯІЇЄҐA-Z0-9«"(])/);
}

export function parseDescription(raw: string | null | undefined): Block[] {
  const text = normalizeDescription(raw);
  if (!text) return [];
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  let kv: [string, string][] = [];

  // короткая строка с двоеточием или строка ЗАГЛАВНЫМИ буквами — подзаголовок
  const headingOf = (line: string): string | null => {
    if (/:$/.test(line) && line.length <= 60) return line.replace(/:$/, "");
    if (line.length <= 40 && /[А-ЯІЇЄҐA-Z]/.test(line) && line === line.toUpperCase() && !/[.!?]$/.test(line)) return line.charAt(0) + line.slice(1).toLowerCase();
    return null;
  };
  const flushPara = () => {
    if (!para.length) return;
    const h = para.length === 1 ? headingOf(para[0]) : null;
    if (h) blocks.push({ t: "h", text: h });
    else blocks.push({ t: "p", lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ t: list.kind, items: list.items });
    list = null;
  };
  const flushKv = () => {
    if (kv.length >= 3) blocks.push({ t: "dl", rows: kv });
    else if (kv.length) para.push(...kv.map(([k, v]) => `${k}: ${v}`));
    kv = [];
  };
  const flushAll = () => {
    flushKv();
    flushPara();
    flushList();
  };

  for (const line of text.split("\n")) {
    if (!line) {
      flushAll();
      continue;
    }
    const b = BULLET.exec(line);
    const n = NUMBERED.exec(line);
    if (b || n) {
      flushKv();
      flushPara();
      const kind = n && !b ? "ol" : "ul";
      if (list && list.kind !== kind) flushList();
      list ??= { kind, items: [] };
      list.items.push((b ? b[1] : n![2]).trim());
      continue;
    }
    flushList();
    const m = KV.exec(line);
    if (m && para.length === 1 && !kv.length && headingOf(para[0])) flushPara(); // подзаголовок прямо перед таблицей
    if (m && !para.length) {
      kv.push([m[1].trim(), m[2].trim()]);
      continue;
    }
    flushKv();
    para.push(line);
  }
  flushAll();

  // Один длинный абзац без разбивки — делим по предложениям, чтобы текст читался
  if (blocks.length === 1 && blocks[0].t === "p" && blocks[0].lines.length === 1 && blocks[0].lines[0].length > 420) {
    const sentences = splitSentences(blocks[0].lines[0]);
    if (sentences.length > 3) {
      const out: Block[] = [];
      let cur: string[] = [];
      let len = 0;
      for (const s of sentences) {
        cur.push(s);
        len += s.length;
        if (cur.length >= 3 || len >= 320) {
          out.push({ t: "p", lines: [cur.join(" ")] });
          cur = [];
          len = 0;
        }
      }
      if (cur.length) out.push({ t: "p", lines: [cur.join(" ")] });
      return out;
    }
  }
  return blocks;
}
