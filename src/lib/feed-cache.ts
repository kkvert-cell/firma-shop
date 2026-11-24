// Временное хранение скачанного фида на время одного кола обновления (кэш Cloudflare, Cache API),
// чтобы не скачивать большой фид заново для каждой порции. Если кэша нет (локально, тесты) — просто скачиваем снова.
// Только относительные импорты: файл используется в cron-воркере.

export type FeedCache = {
  get(key: string): Promise<string | null>;
  put(key: string, text: string, ttlSec: number): Promise<void>;
};

const reqFor = (key: string) => new Request(`https://feed-cache.invalid/${encodeURIComponent(key)}`);

export function workersFeedCache(): FeedCache | null {
  const c = (globalThis as unknown as { caches?: { default?: { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> } } }).caches?.default;
  if (!c) return null;
  return {
    async get(key) {
      try {
        const r = await c.match(reqFor(key));
        return r ? await r.text() : null;
      } catch {
        return null;
      }
    },
    async put(key, text, ttlSec) {
      try {
        await c.put(reqFor(key), new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": `public, max-age=${ttlSec}` } }));
      } catch {
        // кэш недоступен — следующая порция скачает фид заново
      }
    },
  };
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
