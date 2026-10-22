"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart } from "@/lib/cart";

export type AddToCartProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  available: boolean;
  maxQty: number; // сколько можно купить (при точном остатке — остаток, иначе 99)
};

export default function AddToCart({ product }: { product: AddToCartProduct }) {
  const [state, setState] = useState<"idle" | "added" | "limit">("idle");

  if (!product.available || product.price <= 0) {
    return (
      <button type="button" className="btn-primary add-btn" disabled>
        {product.available ? "Ціну уточнюйте" : "Немає в наявності"}
      </button>
    );
  }

  return (
    <div className="add-to-cart">
      <button
        type="button"
        className="btn-primary add-btn"
        onClick={() => {
          const { id, slug, name, price, image } = product;
          setState(addToCart({ id, slug, name, price, image }, product.maxQty));
        }}
      >
        Додати в кошик
      </button>
      {state === "added" && (
        <p className="add-note stock-in">
          Додано в кошик. <Link href="/cart">Перейти до кошика →</Link>
        </p>
      )}
      {state === "limit" && <p className="add-note stock-out">У кошику вже максимальна кількість цього товару.</p>}
    </div>
  );
}
