// Красивое оформление описаний: абзацы, списки, подзаголовки и таблица характеристик.
// Исходный текст — обычный (из Prom или набранный в админке). Правила простые и описаны подсказкой под полем описания.

import { hyphenateSync } from "hyphen/uk";

export type Block =
  | { t: "p"; lines: string[] }
  | { t: "h"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "dl"; rows: [string, string][] }
  | { t: "table"; caption: string; head: string[]; rows: string[][] };

const NAMED: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", deg: "°", times: "×", plusmn: "±", micro: "µ", bull: "•" };
const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);

const TAGS = "p|div|br|ul|ol|li|h[1-6]|span|strong|b|em|i|u|a|font|table|tbody|thead|tr|td|th|section|article|img|hr";

// Превращает описание с HTML-разметкой (если оно попало из Prom) в обычный текст с переводами строк
export function normalizeDescription(raw: string | null | undefined): string {
  let s = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029\u0085]/g, "\n")
    .replace(/[\p{Cf}\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "") // невидимые символы (нулевой ширины, мягкий перенос, метки направления)
    .replace(/\p{Zs}/gu, " "); // любые необычные пробелы
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

const MARK_CHARS = "\\p{Pd}\\u2212\\u2043*•·▪●◦‣∙■□◆◇►▶➤➢✔✓✅✦★→";
const BULLET = new RegExp(`^[${MARK_CHARS}]\\s+(.*)$`, "u");
const NUMBERED = /^(\d{1,2})[.)]\s+(.*)$/;
const KV = /^([^:\n]{2,40}):\s+(\S.{0,119})$/;

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=[А-ЯІЇЄҐA-Z0-9«"(])/);
}


// Список, «склеенный» в одну строку: «…такі показники як: - обороти; - навантаження; - температура; і ще багато…».
// Разбираем его на подводку, пункты и хвост, чтобы каждый пункт был с новой строки.
// В одной строке может быть несколько таких списков подряд (с подзаголовком перед каждым).
const INLINE_MARK = new RegExp(`(^|\\s)([${MARK_CHARS}])\\s+(?=\\S)`, "gu");
const WEAK_MARK = /^[\p{Pd}\u2212*]$/u; // обычные дефисы и звёздочка — «слабые» маркеры: для них нужна подводка с двоеточием
const UP = "А-ЯІЇЄҐA-Z";
// Дефис между числами — это диапазон («3.5 - 9.0», «0 - 99%»), а не маркер нового пункта списка
function isRangeMark(line: string, m: RegExpMatchArray): boolean {
  if (!WEAK_MARK.test(m[2])) return false;
  const before = line.slice(0, m.index).trimEnd();
  const after = line.slice(m.index! + m[0].length);
  // «6 В - 0,001 В», «40 Гц - 1 кГц», «3.5 - 9.0»: слева число (с единицей), справа тоже число
  return /\d[\d.,\s]*[A-Za-zА-Яа-яІіЇїЄєҐґµμΩ°%/.]{0,12}$/.test(before) && /^[\d+]/.test(after);
}

// «3.5 - 9.0» → «3.5–9.0»: диапазон чисел пишем с короткой чертой без пробелов
const RANGE = /(\d(?:\s?(?:%|°[CFС]))?)\s+[-–—−]\s+(?=\d)/g;
let rangeUnits: RegExp | null = null;
export const tidyRanges = (s: string) => {
  // «40 Гц - 1 кГц» → «40 Гц–1 кГц»
  rangeUnits ??= new RegExp(`(\\d(?:[.,]\\d+)?\\s?[A-Za-zА-Яа-яІіЇїЄєҐґµμΩ°%/.]{1,12})\\s+[-–—−]\\s+(?=\\d)`, "g");
  return s.replace(RANGE, "$1–").replace(rangeUnits, "$1–");
};

function expandInlineList(line: string): string {
  if (line.length < 30) return line;
  let marks = [...line.matchAll(INLINE_MARK)].filter((m) => !isRangeMark(line, m));
  // Тире внутри пункта («…натисніть кнопку - результати з'являться…», «…умовах - вдома, у саду…») — не новий пункт.
  // Надёжный маркер: в начале строки, после «. ; : ! ?» или перед словом с заглавной буквы. Если таких маркеров в строке
  // хотя бы три, «ненадёжные» дефисы (после слова, перед строчной буквой) считаем обычным тире внутри предложения.
  const isClear = (m: RegExpMatchArray) => {
    const before = line.slice(0, m.index).trimEnd();
    const after = line.slice(m.index! + m[0].length);
    return m.index === 0 || /[.;:!?…]$/.test(before) || /^[А-ЯІЇЄҐA-Z0-9«"(]/.test(after);
  };
  if (marks.filter((m) => WEAK_MARK.test(m[2]) && isClear(m)).length >= 3) {
    marks = marks.filter((m) => !WEAK_MARK.test(m[2]) || isClear(m));
  }
  // Список начинается с первого маркера, перед которым стоит двоеточие (или с обычных значков «•»).
  // Так тире внутри вводного текста («Модель X - это прибор…») не мешает найти список дальше по строке.
  const bulletStart = marks.findIndex((m) => !WEAK_MARK.test(m[2]));
  const colonStart = marks.findIndex((m) => m.index === 0 || /[:：]$/.test(line.slice(0, m.index).trimEnd()));
  const startIdx = colonStart >= 0 ? (bulletStart >= 0 ? Math.min(colonStart, bulletStart) : colonStart) : bulletStart;
  if (startIdx < 0) return line;
  marks = marks.slice(startIdx);
  const strong = marks.filter((m) => !WEAK_MARK.test(m[2])).length;
  if (!(strong >= 2 || marks.length >= 3)) return line;
  const first = marks[0];
  const head = line.slice(0, first.index).trim();
  const raw: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : line.length;
    raw.push(line.slice(start, end).trim());
  }
  const trim = (x: string) => x.replace(/[;,.\s]+$/, "").trim();
  const out: string[] = [];
  if (head) {
    // «…предложение. Особливості:» — подзаголовок списка отдельной строкой
    const hh = new RegExp(`^(.*[.!?])\\s+([${UP}][^.!?]{1,50}:)$`).exec(head);
    if (hh) out.push(hh[1], "", hh[2]);
    else out.push(head);
  }
  let items = 0;
  raw.forEach((x, i) => {
    const isLast = i === raw.length - 1;
    // пункт + подзаголовок следующего списка («…работы. Вимірювані величини (діапазон; точність):»)
    const nh = !isLast ? new RegExp(`^(.*[.!?])\\s+([${UP}][^.!?]*:)$`).exec(x) : null;
    if (nh) {
      out.push(`• ${trim(nh[1])}`);
      out.push(nh[2].trim());
      items++;
      return;
    }
    if (isLast) {
      // хвост после списка: отдельное предложение или «; і ще багато…»
      const cut = new RegExp(`\\.\\s+(?=[${UP}])|[;]\\s+(?=(?:і|та)\\s+(?:ще|інш|т\\.)|тощо)`, "i").exec(x);
      if (cut && cut.index > 0) {
        const tail = x.slice(cut.index + cut[0].length).trim();
        out.push(`• ${trim(x.slice(0, cut.index))}`);
        items++;
        if (tail) out.push(tail.charAt(0).toUpperCase() + tail.slice(1));
        return;
      }
    }
    const t = trim(x);
    if (t) {
      out.push(`• ${t}`);
      items++;
    }
  });
  if (items < 2) return line;
  return out.join("\n");
}


// ===== «…навчання. Характеристики: Осцилограф» внутри пункта списка — это начало нового раздела, а не продолжение пункта =====
const SECTION_IN_ITEM = /^([\s\S]*?[.!?])\s+((?:Технічні\s+)?(?:Характеристики|Комплектація|Параметри|Переваги|Особливості|Застосування|Специфікація|Технічні\s+дані)):\s*([\s\S]*)$/;

// Второй конец диапазона, ставший отдельным пунктом («Часова база: 20 нс/поділка» + «20 с/поділка»), склеиваем обратно
const VALUE_ONLY = /^\d[\d.,\s]*[A-Za-zА-Яа-яІіЇїЄєҐґµμΩ°%/.]{0,12}$/;
const ENDS_WITH_VALUE = /\d[\d.,\s]*[A-Za-zА-Яа-яІіЇїЄєҐґµμΩ°%/.]{0,12}$/;
function mergeRangeItems(items: string[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const x = it.trim();
    const prev = out[out.length - 1];
    if (prev !== undefined && VALUE_ONLY.test(x) && /: /.test(prev) && ENDS_WITH_VALUE.test(prev) && prev.length < 90) {
      out[out.length - 1] = `${prev}–${x}`;
    } else out.push(it);
  }
  return out;
}

function splitSectionHeadings(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b0 of blocks) {
    const b: Block = b0.t === "ul" || b0.t === "ol" ? { t: b0.t, items: mergeRangeItems(b0.items) } : b0;
    if (b.t !== "ul" && b.t !== "ol") {
      out.push(b);
      continue;
    }
    let items: string[] = [];
    for (const it of b.items) {
      const m = SECTION_IN_ITEM.exec(it);
      if (!m) {
        items.push(it);
        continue;
      }
      items.push(m[1].trim());
      out.push({ t: b.t, items });
      out.push({ t: "h", text: m[2] });
      items = m[3].trim() ? [m[3].trim()] : [];
    }
    if (items.length) out.push({ t: b.t, items });
  }
  return out;
}

// ===== Таблицы измерительных характеристик: «6 В – 0,001 В; ±(0,5% + 5d).» → диапазон / разрешение / точность =====
const MU = "[A-Za-zА-Яа-яІіЇїЄєҐґµμΩ]{1,4}";
const SPEC_ROW = new RegExp(`(\\d[\\d.,]*\\s?${MU})\\s*[-–—]\\s*(\\d[\\d.,]*\\s?${MU})\\s*;\\s*(±\\s?\\([^)]*\\)|±\\s?[\\d.,]+\\s?%?)\\s*[.;]?`, "g");
const SPEC_HEAD = ["Діапазон", "Роздільна здатність", "Точність"];
// Предложения; а «Підпис: Наступна назва:» (двокрапка перед словом з великої літери) теж розділяємо
const splitSentences2 = (x: string) =>
  x
    .split(/(?<=[.!?])\s+(?=[А-ЯІЇЄҐA-Z0-9«"(])|(?<=:)\s+(?=[А-ЯІЇЄҐ])/)
    .map((y) => y.trim())
    .filter(Boolean);

function extractSpecTables(line: string): Block[] | null {
  const rows = [...line.matchAll(SPEC_ROW)];
  if (rows.length < 3) return null;
  const out: Block[] = [];
  let table: { caption: string; rows: string[][] } | null = null;
  let cursor = 0;
  const flush = () => {
    if (table) out.push({ t: "table", caption: table.caption, head: SPEC_HEAD, rows: table.rows });
    table = null;
  };
  for (const m of rows) {
    // Между строками таблицы могут стоять «;» или «.» — это не новый раздел
    const gap = line.slice(cursor, m.index).replace(/^[\s;,.]+/, "").trim();
    if (gap) {
      flush();
      const sents = splitSentences2(gap);
      let caption = "";
      const last = sents[sents.length - 1];
      if (last && /:$/.test(last)) {
        caption = last.replace(/:$/, "").trim();
        sents.pop();
      }
      for (const x of sents) out.push(/:$/.test(x) ? { t: "h", text: x.replace(/:$/, "") } : { t: "p", lines: [x] });
      table = { caption, rows: [] };
    } else if (!table) {
      table = { caption: "", rows: [] };
    }
    table!.rows.push([m[1].trim(), m[2].trim(), m[3].trim()]);
    cursor = m.index! + m[0].length;
  }
  flush();
  for (const x of splitSentences2(line.slice(cursor).trim())) out.push({ t: "p", lines: [x] });
  return out;
}

// ===== Типографіка: дрібні виправлення тексту, щоб він читався охайно і добре вирівнювався =====
const NBSP = "\u00A0";
const LET = "А-ЯІЇЄҐа-яіїєґA-Za-z";
const UNITS = "Вт|кВт|МВт|мВт|В|кВ|мВ|А|мА|Гц|кГц|МГц|ГГц|мм|см|дм|км|м|кг|мг|г|т|мл|л|шт|хв|сек|секунд[а-яі]*|год|годин[а-яі]*|дн|днів|відліків|люкс|lux|pH|Ом|кОм|МОм|мкФ|мФ|нФ|пФ|Ф|Н|Па|кПа|бар|дБ|dB|об/хв|мАг|Втгод|Мб|МБ|Гб|ГБ|Кб|КБ|px|дюйм[а-яі]*";
const RE_NUM_UNIT = new RegExp(`(\\d)\\s+(?=(?:°|%|₴|(?:${UNITS})(?![${LET}])))`, "g");
const RE_NUM_RANGE = new RegExp(`(?<![\\d-])(\\d+(?:[.,]\\d+)?)-(\\d+(?:[.,]\\d+)?)(?=\\s?(?:%|°|₴|[${LET}]))`, "g");
const RE_SHORT_WORD = /(^|[\s(«"„—–])([ВвУуЗзІіЙйАаОоЖжБбКкСс])[ \t]+(?=\S)/g;
const RE_COMMA_LETTER = new RegExp(`,(?=[${LET}])`, "g");
const RE_SKIP = /(\S*(?:https?:\/\/|www\.|@)\S*)/;

function typoPart(t: string): string {
  return t
    .replace(/℃/g, "°C") // одним значком: ℃ → °C, ℉ → °F
    .replace(/℉/g, "°F")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,;:!?])/g, "$1") // пробіл перед комою, крапкою з комою, двокрапкою, знаками оклику
    .replace(/\s+\.(?!\.)(?=\s|$)/g, ".") // пробіл перед крапкою в кінці речення
    .replace(/\s+\.(?=[А-ЯІЇЄҐ])/g, ". ") // «екрані .Паяльник» → «екрані. Паяльник»
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(RE_COMMA_LETTER, ", ") // пропущений пробіл після коми
    .replace(/([а-яіїєґ])\.(?=[А-ЯІЇЄҐ])/g, "$1. ") // «екрані.Паяльник» → «екрані. Паяльник»
    .replace(RE_NUM_RANGE, "$1–$2") // 180-500 °С → 180–500 °С
    .replace(RE_NUM_UNIT, `$1${NBSP}`) // число + одиниця не розриваються
    .replace(/(^|\S) [-–] (?=\S)/g, `$1${NBSP}— `) // «908V - це» → «908V — це»
    .replace(/(\d{1,3}) (?=\d{3}(?!\d))/g, `$1${NBSP}`) // 1 150 ₴ — тисячі не розриваються
    .replace(RE_SHORT_WORD, `$1$2${NBSP}`); // однолітерні слова (в, у, з, і, й…) не лишаються в кінці рядка
}


// ===== М'які переноси: щоб текст по ширині не розтягувався великими пробілами, довгі слова переносимо за правилами =====
const SHY = "\u00AD";
const CYR = "А-ЯІЇЄҐа-яіїєґ";
const RE_LONG_WORD = new RegExp(`(?<![${CYR}'’ʼ-])[${CYR}]{7,}(?![${CYR}'’ʼ-])`, "g");
const hyphCache = new Map<string, string>();
function hyphenWord(w: string): string {
  const hit = hyphCache.get(w);
  if (hit !== undefined) return hit;
  // Бібліотека дає пропозиції переносів; залишаємо лише ті, що лишають не менше 3 літер з кожного боку
  const parts = hyphenateSync(w, { hyphenChar: "|", minWordLength: 7 }).split("|");
  const out: string[] = [];
  let cur = "";
  for (const part of parts) {
    cur += part;
    if (cur.length >= 3) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) {
    if (out.length) out[out.length - 1] += cur;
    else out.push(cur);
  }
  const res = out.join(SHY);
  hyphCache.set(w, res);
  return res;
}

// Додає м'які переноси в довгі українські слова (не чіпає посилання, пошту, слова з цифрами й латиницею)
export function hyphenateText(text: string): string {
  if (!text) return text;
  return text
    .split(RE_SKIP)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(RE_LONG_WORD, hyphenWord)))
    .join("");
}

// Последнее слово абзаца не остаётся на строке одно: склеиваем его с предыдущим (если вместе недлинно)
export function tieLast(text: string): string {
  const m = /^([\s\S]*\S)\s+(\S+)$/.exec(text);
  if (!m) return text;
  const prev = /(\S+)$/.exec(m[1]);
  if (!prev || prev[1].length + m[2].length > 22) return text;
  return `${m[1]}\u00A0${m[2]}`;
}

export function typo(text: string): string {
  if (!text) return text;
  return text
    .split(RE_SKIP)
    .map((part, i) => (i % 2 === 1 ? part : typoPart(part)))
    .join("");
}

export function parseDescription(raw: string | null | undefined): Block[] {
  const text = tidyRanges(
    normalizeDescription(raw)
      .split("\n")
      .map(expandInlineList)
      .join("\n")
  );
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

  // Длинный абзац из одной строки делим по предложениям, чтобы текст читался
  let res: Block[] = [];
  for (const b of blocks) {
    if (b.t === "p" && b.lines.length === 1 && b.lines[0].length > 420) {
      const sentences = splitSentences(b.lines[0]);
      if (sentences.length > 3) {
        let cur: string[] = [];
        let len = 0;
        for (const sn of sentences) {
          cur.push(sn);
          len += sn.length;
          if (cur.length >= 3 || len >= 320) {
            res.push({ t: "p", lines: [cur.join(" ")] });
            cur = [];
            len = 0;
          }
        }
        if (cur.length) res.push({ t: "p", lines: [cur.join(" ")] });
        continue;
      }
    }
    res.push(b);
  }
  // Таблицы характеристик: абзацы подряд склеиваем и ищем в них строки «6 В – 0,001 В; ±(0,5% + 5d).»
  const withTables: Block[] = [];
  res = splitSectionHeadings(res);
  const hasSpec = (x: string) => [...x.matchAll(SPEC_ROW)].length >= 3;
  for (let i = 0; i < res.length; ) {
    const cur = res[i];
    if ((cur.t === "ul" || cur.t === "ol") && cur.items.some(hasSpec)) {
      // таблица «приклеилась» к пункту списка: вступление остаётся пунктом, таблицы идут после списка
      const idx = cur.items.findIndex(hasSpec);
      const t = extractSpecTables(cur.items[idx]) ?? [];
      const lead: string[] = [];
      while (t.length && t[0].t === "p") lead.push((t.shift() as Extract<Block, { t: "p" }>).lines.join(" "));
      const before = [...cur.items.slice(0, idx), ...(lead.length ? [lead.join(" ")] : [])];
      if (before.length) withTables.push({ t: cur.t, items: before });
      withTables.push(...t);
      const after = cur.items.slice(idx + 1);
      if (after.length) withTables.push({ t: cur.t, items: after });
      i++;
      continue;
    }
    if (cur.t !== "p") {
      withTables.push(res[i++]);
      continue;
    }
    let j = i;
    while (j < res.length && res[j].t === "p") j++;
    const run = res.slice(i, j) as Extract<Block, { t: "p" }>[];
    const tables = extractSpecTables(run.map((b) => b.lines.join(" ")).join(" "));
    if (tables) withTables.push(...tables);
    else withTables.push(...run);
    i = j;
  }
  return withTables.map((b): Block => {
    if (b.t === "table") return { t: "table", caption: typo(b.caption), head: b.head, rows: b.rows.map((r) => r.map(typo)) };
    if (b.t === "p") return { t: "p", lines: b.lines.map((l) => tieLast(hyphenateText(typo(l)))) };
    if (b.t === "h") return { t: "h", text: typo(b.text) };
    if (b.t === "ul" || b.t === "ol") return { t: b.t, items: b.items.map((x) => tieLast(hyphenateText(typo(x)))) };
    return { t: "dl", rows: b.rows.map(([k, v]) => [typo(k), typo(v)] as [string, string]) };
  });
}
