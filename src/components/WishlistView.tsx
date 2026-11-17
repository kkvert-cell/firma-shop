"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import type { ProductCardData } from "@/lib/catalog";
import { readWish, removeWish, subscribeWish } from "@/lib/wishlist";

type Item = ProductCardData & { id: string };

export default function WishlistView() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sync = () => setIds(readWish());
    sync();
    return subscribeWish(sync);
  }, []);

  const key = (ids ?? []).join(",");
  useEffect(() => {
    if (!key) return;
    let off = false;
    fetch("/api/cart/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: key.split(",") }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("check"))))
      .then(({ items: rows }: { items: Item[] }) => {
        if (!off) setItems(Object.fromEntries(rows.map((x) => [x.id, x])));
      })
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [key]);

  if (ids === null) return <p className="muted">Завантаження…</p>;
  if (ids.length === 0)
    return (
      <>
        <p className="muted">В обраному поки порожньо. Натискайте «♡ В обране» на сторінці товару, щоб зберегти його тут.</p>
        <p><Link href="/catalog" className="btn-primary">До каталогу</Link></p>
      </>
    );
  if (failed) return <p className="notice error">Не вдалося завантажити обране. Оновіть сторінку.</p>;
  const shown = ids.filter((id) => items[id]);
  return (
    <>
      <div className="product-grid">
        {shown.map((id) => (
          <div key={id}>
            <ProductCard p={items[id]} />
            <p><button type="button" className="btn-secondary" onClick={() => removeWish(id)}>Прибрати з обраного</button></p>
          </div>
        ))}
      </div>
    </>
  );
}
