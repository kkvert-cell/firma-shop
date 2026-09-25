import Link from "next/link";

// Главный экран админки. В реальном проекте цифры приходят агрегирующими
// запросами к Order/Product (COUNT, SUM, GROUP BY). Доступ защищён middleware,
// проверяющим role === "ADMIN" | "MANAGER" (см. User.role в schema.prisma).

const stats = [
  { label: "Замовлення сьогодні", value: "7" },
  { label: "Продажі за місяць", value: "142 800 ₴" },
  { label: "Середній чек", value: "894 ₴" },
  { label: "Товарів з низьким залишком", value: "12" },
];

const recentOrders = [
  { id: "F-10241", customer: "Ігор П.", total: 947, status: "Новe" },
  { id: "F-10240", customer: "ТОВ «Технобуд»", total: 12400, status: "Очікує оплати" },
  { id: "F-10239", customer: "Марія К.", total: 349, status: "Відправлено" },
];

const navSections = [
  { href: "/admin/products", label: "Товари" },
  { href: "/admin/products/import", label: "Імпорт з Excel" },
  { href: "/admin/categories", label: "Категорії" },
  { href: "/admin/orders", label: "Замовлення" },
  { href: "/admin/customers", label: "Клієнти" },
  { href: "/admin/seo", label: "SEO" },
];

export default function AdminDashboard() {
  return (
    <main className="admin-layout">
      <nav className="card" style={{ padding: "var(--space-4)" }}>
        {navSections.map((item) => (
          <Link key={item.href} href={item.href} style={{ display: "block", padding: "var(--space-2) 0" }}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section>
        <h1 className="heading" style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-4)" }}>
          Дашборд
        </h1>

        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="card" style={{ padding: "var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>{stat.label}</div>
              <div className="data" style={{ fontSize: "var(--text-xl)" }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="tick-divider" style={{ margin: "var(--space-6) 0" }} />

        <h2 className="heading" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>
          Останні замовлення
        </h2>
        {recentOrders.map((order) => (
          <div
            key={order.id}
            className="card"
            style={{ padding: "var(--space-3)", marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between" }}
          >
            <span className="data">{order.id}</span>
            <span>{order.customer}</span>
            <span style={{ color: "var(--color-ink-muted)" }}>{order.status}</span>
            <span className="price data">{order.total} ₴</span>
          </div>
        ))}
      </section>
    </main>
  );
}
