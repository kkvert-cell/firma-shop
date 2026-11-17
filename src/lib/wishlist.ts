// «Обране» зберігається в браузері (localStorage), як і кошик: працює без реєстрації.
// Ціни й наявність береться свіжими з сервера на сторінці /wishlist.

const KEY = "firma-wish-v1";
const EVENT = "firma-wish";
export const MAX_WISH = 60;

export function readWish(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && /^[0-9a-zA-Z-]{6,64}$/.test(x)).slice(0, MAX_WISH) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_WISH)));
  } catch {
    // приватний режим / переповнення — обране просто не збережеться
  }
  window.dispatchEvent(new Event(EVENT));
}

export function toggleWish(id: string): boolean {
  const ids = readWish();
  const has = ids.includes(id);
  write(has ? ids.filter((x) => x !== id) : [id, ...ids]);
  return !has;
}

export const removeWish = (id: string) => write(readWish().filter((x) => x !== id));

export function subscribeWish(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
