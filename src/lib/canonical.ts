// Єдина адреса сайту: з «www.» та зі старої адреси на workers.dev відвідувачів переводимо на основний домен (301).
// Лише для сторінок (GET/HEAD) — запити до /api (вебхуки KeyCRM, оплата, синхронізація) не чіпаємо.
export function canonicalRedirect(opts: { host: string; pathname: string; search: string; method: string; siteUrl: string }): string | null {
  const { host, pathname, search, method, siteUrl } = opts;
  if (method !== "GET" && method !== "HEAD") return null;
  if (pathname.startsWith("/api/")) return null;
  let canonical: URL;
  try {
    canonical = new URL(siteUrl);
  } catch {
    return null;
  }
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (h === canonical.hostname) return null;
  // Переводимо лише «www.» цього домену та стару адресу workers.dev (локальна розробка й інші хости не зачіпаються)
  if (h !== `www.${canonical.hostname}` && !h.endsWith(".workers.dev")) return null;
  return `${canonical.origin}${pathname}${search}`;
}
