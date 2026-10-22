"use client";

// Общая логика для страниц "Кошик" и "Оформлення": читает корзину из браузера и сверяет её
// со свежими ценами и наличием с сервера.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CartLine, MAX_QTY, readCart, subscribeCart, writeCart } from "./cart";
import { formatPrice } from "./site";

export type Fresh = {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  isAvailable: boolean;
  stockQty: number;
  stockExact: boolean;
  image: string | null;
};

export type CartView = CartLine & { available: boolean; reason: string | null; max: number };

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [mounted, setMounted] = useState(false);
  const [fresh, setFresh] = useState<Record<string, Fresh> | null>(null);
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setLines(readCart());
    sync();
    setMounted(true);
    return subscribeCart(sync);
  }, []);

  const idsKey = useMemo(() => lines.map((l) => l.id).sort().join(","), [lines]);

  useEffect(() => {
    if (!mounted) return;
    if (!idsKey) {
      setFresh({});
      return;
    }
    let cancelled = false;
    fetch("/api/cart/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: idsKey.split(",") }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("check failed"))))
      .then(({ items }: { items: Fresh[] }) => {
        if (cancelled) return;
        const map: Record<string, Fresh> = Object.fromEntries(items.map((i) => [i.id, i]));
        // Подтягиваем свежие цены и ограничиваем количество остатком
        const cur = readCart();
        const msgs: string[] = [];
        let changed = false;
        for (const l of cur) {
          const f = map[l.id];
          if (!f) continue;
          if (f.price > 0 && f.price !== l.price) {
            msgs.push(`Ціна «${l.name}» змінилась: ${formatPrice(l.price)} → ${formatPrice(f.price)} ₴`);
            l.price = f.price;
            changed = true;
          }
          if (f.isAvailable && f.stockExact && f.stockQty > 0 && l.qty > f.stockQty) {
            msgs.push(`«${l.name}»: доступно лише ${f.stockQty} шт.`);
            l.qty = f.stockQty;
            changed = true;
          }
        }
        if (changed) writeCart(cur);
        setNotices(msgs);
        setFresh(map);
      })
      .catch(() => {
        if (!cancelled) setFresh({}); // сервер недоступен — покажем то, что есть; при оформлении всё проверится ещё раз
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, idsKey]);

  const view: CartView[] = lines.map((l) => {
    const f = fresh?.[l.id];
    const known = fresh !== null && Object.keys(fresh).length > 0;
    if (known && !f) return { ...l, available: false, reason: "більше не продається", max: 1 };
    if (!f) return { ...l, available: true, reason: null, max: MAX_QTY };
    const available = f.isAvailable && f.price > 0;
    return {
      ...l,
      name: f.name,
      price: f.price > 0 ? f.price : l.price,
      image: f.image ?? l.image,
      available,
      reason: !f.isAvailable ? "немає в наявності" : f.price > 0 ? null : "ціну уточнюйте за телефоном",
      max: f.stockExact && f.stockQty > 0 ? Math.min(MAX_QTY, f.stockQty) : MAX_QTY,
    };
  });

  const setQty = useCallback((id: string, qty: number) => {
    const cur = readCart();
    const l = cur.find((x) => x.id === id);
    if (!l) return;
    l.qty = Math.max(1, Math.min(MAX_QTY, Math.floor(qty)));
    writeCart(cur);
  }, []);

  const remove = useCallback((id: string) => writeCart(readCart().filter((l) => l.id !== id)), []);
  const clear = useCallback(() => writeCart([]), []);

  const total = view.reduce((s, l) => s + l.price * l.qty, 0);
  const blocked = view.some((l) => !l.available);
  return { mounted, loading: !mounted || fresh === null, view, notices, setQty, remove, clear, total, blocked };
}
