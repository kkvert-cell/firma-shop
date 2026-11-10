// Рік запуску сайту. Змінювати не потрібно: далі рахується сам.
export const SITE_START_YEAR = 2026;

// 2026 → «2026», 2027 → «2026–2027», 2028 → «2026–2028»
export function copyrightYears(current: number, start = SITE_START_YEAR): string {
  return current > start ? `${start}–${current}` : String(start);
}
