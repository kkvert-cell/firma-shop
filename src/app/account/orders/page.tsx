import Link from "next/link";

// Личный кабинет: вкладки-разделы. Для юрлиц (role = COMPANY_REP) появляется
// дополнительный пункт "Реквізити компанії" — данные из модели Company.

const navItems = [
  { href: "/account/orders", label: "Історія замовлень" },
  { href: "/account/wishlist", label: "Обране" },
  { href: "/account/addresses", label: "Адреси доставки" },
  { href: "/account/company", label: "Реквізити компанії" },
];

const mockOrders = [
  { id: "F-10234", date: "18.09.2026", total: 947, status: "Доставлено" },
  { id: "F-10198", date: "02.09.2026", total: 349, status: "В дорозі" },
];

export default function AccountOrdersPage() {
  return (
    <main>
      <h1 className="heading" style={{ fontSize: "var(--text-2xl)" }}>Особистий кабінет</h1>

      <div className="tick-divider" style={{ margin: "var(--space-4) 0" }} />

      <div className="account-layout">
        <nav className="card" style={{ padding: "var(--space-4)" }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ display: "block", padding: "var(--space-2) 0" }}>
              {item.label}
            </Link>
          ))}
        </nav>

        <section>
          <h2 className="heading" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>
            Історія замовлень
          </h2>

          {mockOrders.map((order) => (
            <div
              key={order.id}
              className="card"
              style={{
                padding: "var(--space-4)",
                marginBottom: "var(--space-3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="data">{order.id}</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>{order.date}</div>
              </div>
              <div style={{ color: "var(--color-ink-muted)" }}>{order.status}</div>
              <div className="price data">{order.total} ₴</div>
              <button style={{ fontSize: "var(--text-sm)" }}>Повторити замовлення</button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
