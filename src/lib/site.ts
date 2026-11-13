// Общие константы сайта. Основний домен: firmashop.com.ua (можна перевизначити через NEXT_PUBLIC_SITE_URL у налаштуваннях збірки).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://firmashop.com.ua").replace(/\/$/, "");
export const SITE_NAME = "Firma SHOP";
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
