"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount, readCart, subscribeCart } from "@/lib/cart";

export default function CartLink() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const update = () => setN(cartCount(readCart()));
    update();
    return subscribeCart(update);
  }, []);
  return (
    <Link href="/cart" className="header-link cart-link">
      Кошик{n > 0 && <span className="cart-badge">{n}</span>}
    </Link>
  );
}
