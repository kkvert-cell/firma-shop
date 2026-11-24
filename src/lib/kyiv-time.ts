// Время по Киеву (Europe/Kyiv) с учётом перехода на летнее/зимнее время.
// Cloudflare Cron работает только в UTC, поэтому «когда запускать» решаем здесь, а не в расписании.
// Только относительные импорты: файл используется и в cron-воркере.

const TZ = (() => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: "Europe/Kyiv" });
    return "Europe/Kyiv";
  } catch {
    return "Europe/Kiev"; // старое имя зоны в старых сборках ICU
  }
})();

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export type KyivParts = { year: number; month: number; day: number; hour: number; minute: number };

export function kyivParts(d: Date): KyivParts {
  const o: Record<string, number> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { year: o.year, month: o.month, day: o.day, hour: o.hour % 24, minute: o.minute };
}

// Момент времени (UTC) для заданных даты и часа по Киеву. Если такого часа нет (весенний переход), берём зимнее смещение.
export function kyivLocalToUtc(year: number, month: number, day: number, hour: number, minute = 0): Date {
  for (const offset of [3, 2]) {
    const c = new Date(Date.UTC(year, month - 1, day, hour - offset, minute));
    const p = kyivParts(c);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) return c;
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 2, minute));
}

// Начало последнего уже наступившего «слота» (например, 06:00 или 18:00 по Киеву)
export function lastKyivSlotStart(now: Date, hours: number[]): Date {
  const p = kyivParts(now);
  const desc = [...hours].sort((a, b) => b - a);
  for (const back of [0, 1, 2]) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day - back));
    for (const h of desc) {
      const c = kyivLocalToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h);
      if (c.getTime() <= now.getTime()) return c;
    }
  }
  return new Date(now.getTime() - 24 * 3600_000);
}
