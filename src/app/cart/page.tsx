import Link from "next/link";

// Корзина в реальном проекте — client component (нужны onClick для +/- количества
// без перезагрузки страницы), данные хранятся в Cart/CartItem из schema.prisma
// и привязаны либо к userId, либо к sessionId (гость).

const mockCartItems = [
  { id: "1", sku: "SVR-150", name: "Штангенциркуль цифровий 150 мм", price: 349, qty: 1 },
  { id: "2", sku: "MMD-830L", name: "Мультиметр цифровий ANENG", price: 599, qty: 2 },
];

export default function CartPage() {
  const total = mockCartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <main>
      <h1 className="heading" style={{ fontSize: "var(--text-2xl)" }}>Кошик</h1>

      <div className="tick-divider" style={{ margin: "var(--space-4) 0" }} />

      {mockCartItems.length === 0 ? (
        <p>Кошик порожній. <Link href="/catalog">Перейти до каталогу</Link></p>
      ) : (
        <div className="cart-layout">
          <div style={{ flex: 1 }}>
            {mockCartItems.map((item) => (
              <div key={item.id} className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-3)", display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
                <div className="product-image-placeholder" style={{ width: 64, height: 64, flexShrink: 0 }} />

                <div style={{ flex: 1 }}>
                  <div className="data" style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-muted)" }}>
                    Арт. {item.sku}
                  </div>
                  <div>{item.name}</div>
                </div>

                {/* Изменение количества прямо в корзине, как требует ТЗ */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <button aria-label="Зменшити кількість">−</button>
                  <span className="data">{item.qty}</span>
                  <button aria-label="Збільшити кількість">+</button>
                </div>

                <div className="price data" style={{ minWidth: 90, textAlign: "right" }}>
                  {item.price * item.qty} ₴
                </div>

                <button aria-label="Видалити" style={{ color: "var(--color-error)" }}>✕</button>
              </div>
            ))}

            <button style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
              Очистити кошик
            </button>
          </div>

          {/* Итоговая сводка — отдельным блоком, чтобы всегда была видна сумма */}
          <aside className="card cart-summary" style={{ padding: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <strong>Разом</strong>
              <span className="price data" style={{ fontSize: "var(--text-lg)" }}>{total} ₴</span>
            </div>
            <Link href="/checkout" className="btn-primary" style={{ display: "block", textAlign: "center", padding: "12px", borderRadius: "var(--radius)" }}>
              Оформити замовлення
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
