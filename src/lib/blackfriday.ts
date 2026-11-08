// «Чорна п'ятниця»: дати акції. Оформлення вмикається й вимикається саме за київською датою.
// Щоб змінити період, достатньо поправити ці дві дати (формат РРРР-ММ-ДД) та їх текстові версії нижче.
export const BF_FROM = "2026-11-09";
export const BF_TO = "2026-11-29";
export const BF_TO_TEXT = "29.11";
export const BF_PERIOD_TEXT = "9–29 листопада";
export const BF_PERIOD_FULL = "09.11.2026 по 29.11.2026";
export const BF_TERMS_HREF = "/info/black-friday";

function kyivToday(): string {
  // en-CA дає формат РРРР-ММ-ДД
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function isBlackFriday(): boolean {
  const d = kyivToday();
  return d >= BF_FROM && d <= BF_TO;
}

// Скільки днів лишилось, враховуючи сьогодні й останній день
export function bfDaysLeft(): number {
  const [y, m, d] = kyivToday().split("-").map(Number);
  const [y2, m2, d2] = BF_TO.split("-").map(Number);
  const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86400000) + 1;
  return Math.max(diff, 0);
}
