"use client";

import { useRouter } from "next/navigation";
import { CartLine, MAX_QTY, readCart, writeCart } from "@/lib/cart";

// «Замовити ще раз»: кладе товари минулого замовлення в корзину (ціни й наявність перевіряються на сторінці корзини)
export default function ReorderButton({ lines }: { lines: CartLine[] }) {
  const router = useRouter();
  if (!lines.length) return null;
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => {
        const cart = readCart();
        for (const l of lines) {
          const ex = cart.find((c) => c.id === l.id);
          if (ex) {
            ex.qty = Math.min(MAX_QTY, ex.qty + l.qty);
            ex.price = l.price;
          } else cart.push({ ...l });
        }
        writeCart(cart);
        router.push("/cart");
      }}
    >
      Замовити ще раз
    </button>
  );
}
