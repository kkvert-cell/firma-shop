"use client";

import { useEffect, useState } from "react";
import { readWish, subscribeWish, toggleWish } from "@/lib/wishlist";

// Кнопка «В обране» на сторінці товару
export default function WishButton({ id }: { id: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(readWish().includes(id));
    sync();
    return subscribeWish(sync);
  }, [id]);
  return (
    <button type="button" className="btn-secondary wish-btn" aria-pressed={on} onClick={() => setOn(toggleWish(id))}>
      {on ? "♥ В обраному" : "♡ В обране"}
    </button>
  );
}
