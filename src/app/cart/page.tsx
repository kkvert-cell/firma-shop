"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { thumb } from "@/lib/image";
import { useCart } from "@/lib/useCart";
import { formatPrice } from "@/lib/site";

export default function CartPage() {
  const { mounted, loading, view, notices, setQty, remove, total, blocked } = useCart();

  if (!mounted) {
    return (
      <main>
        <h1 className="heading page-title">Кошик</h1>
      </main>
    );
  }

  if (view.length === 0) {
    return (
      <main>
        <h1 className="heading page-title">Кошик</h1>
        <p className="empty-state">
          Кошик порожній. <Link href="/catalog">Перейти до каталогу</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="heading page-title">Кошик</h1>
      {notices.map((n, i) => (
        <p key={i} className="notice">{n}</p>
      ))}

      <div className="cart-page">
        <div>
          {view.map((l) => (
            <div key={l.id} className="card cart-line">
              <div className="cart-line-img">
                {l.image ? <SmartImage src={thumb(l.image, 160)} fallback={l.image} alt={l.name} /> : <span className="no-photo">Немає фото</span>}
              </div>
              <div className="cart-line-main">
                <Link href={`/product/${l.slug}`} className="cart-line-name">{l.name}</Link>
                {!l.available && <div className="stock-out">Не можна замовити: {l.reason}. Приберіть товар з кошика.</div>}
                <div className="data muted">{formatPrice(l.price)} ₴ / шт.</div>
              </div>
              <div className="qty" aria-label="Кількість">
                <button type="button" onClick={() => setQty(l.id, l.qty - 1)} disabled={l.qty <= 1} aria-label="Менше">−</button>
                <span className="data">{l.qty}</span>
                <button type="button" onClick={() => setQty(l.id, l.qty + 1)} disabled={l.qty >= l.max} aria-label="Більше">+</button>
              </div>
              <div className="price data cart-line-total">{formatPrice(l.price * l.qty)} ₴</div>
              <button type="button" className="cart-remove" onClick={() => remove(l.id)} aria-label={`Прибрати «${l.name}»`}>✕</button>
            </div>
          ))}
        </div>

        <aside className="card cart-summary">
          <div className="cart-sum-row">
            <span>Разом</span>
            <span className="price data">{formatPrice(total)} ₴</span>
          </div>
          <p className="muted small">Вартість доставки сплачується за тарифами перевізника.</p>
          {blocked || loading ? (
            <button type="button" className="btn-primary wide" disabled>
              {loading ? "Перевіряємо наявність…" : "Приберіть недоступні товари"}
            </button>
          ) : (
            <Link href="/checkout" className="btn-primary wide">Оформити замовлення</Link>
          )}
        </aside>
      </div>
    </main>
  );
}
