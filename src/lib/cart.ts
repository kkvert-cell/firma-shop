// Корзина покупателя хранится в его браузере (localStorage) — регистрация не нужна.
// Цены и наличие из корзины НИКОГДА не берутся на веру: при оформлении заказа сервер
// заново читает их из базы.

export type CartLine = { id: string; slug: string; name: string; price: number; image: string | null; qty: number };

const KEY = "firma-cart-v1";
const EVENT = "firma-cart";
export const MAX_QTY = 99;

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => l && typeof l.id === "string" && typeof l.name === "string" && Number(l.qty) >= 1)
      .map((l) => ({
        id: l.id,
        slug: String(l.slug ?? ""),
        name: l.name,
        price: Number(l.price) || 0,
        image: typeof l.image === "string" ? l.image : null,
        qty: Math.min(MAX_QTY, Math.floor(Number(l.qty))),
      }));
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // приватный режим / переполнение — корзина просто не сохранится
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(item: Omit<CartLine, "qty">, maxQty: number = MAX_QTY): "added" | "limit" {
  const lines = readCart();
  const cap = Math.min(MAX_QTY, maxQty);
  const existing = lines.find((l) => l.id === item.id);
  if (existing) {
    if (existing.qty >= cap) return "limit";
    existing.qty += 1;
    existing.price = item.price;
  } else {
    lines.push({ ...item, qty: 1 });
  }
  writeCart(lines);
  return "added";
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);

export function subscribeCart(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
