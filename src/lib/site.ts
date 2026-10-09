// Общие константы сайта. Когда появится свой домен — достаточно поменять
// адрес здесь (или задать NEXT_PUBLIC_SITE_URL в настройках сборки).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://firma-shop.kkvert.workers.dev").replace(/\/$/, "");
export const SITE_NAME = "Firma";
export const SHOP_PHONE = "+380968623435";
export const SHOP_PHONE_TEXT = "+38 (096) 862-34-35";

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value);
}

// Склонение: 1 товар, 2 товари, 5 товарів
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
