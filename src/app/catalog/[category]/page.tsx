import Link from "next/link";

// В реальном проекте: категория, товары и фильтры придут из БД по slug'у из URL,
// а список фильтров сгенерируется автоматически из характеристик товаров этой
// категории (это и есть смысл EAV-модели из schema.prisma — фильтры не прошиты
// в код, они выводятся из данных).

const mockProducts = [
  { id: "1", sku: "SVR-150", name: "Штангенциркуль 150 мм", price: 349, oldPrice: 429, image: null },
  { id: "2", sku: "MMD-830L", name: "Мультиметр цифровий ANENG", price: 599, oldPrice: null, image: null },
  { id: "3", sku: "ANG-360", name: "Кутомір цифровий 360°", price: 275, oldPrice: null, image: null },
];

const mockFilters = [
  { name: "Виробник", options: ["ANENG", "FNIRSI", "Mitutoyo", "Bosch"] },
  { name: "Наявність", options: ["В наявності", "Під замовлення"] },
];

export default function CategoryPage() {
  return (
    <main>
      {/* Breadcrumbs — обязательны и для SEO, и чтобы человек понимал где он в каталоге */}
      <nav aria-label="breadcrumbs" style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
        <Link href="/">Головна</Link> / Контрольно-вимірювальний інструмент
      </nav>

      <h1 className="heading" style={{ fontSize: "var(--text-2xl)", margin: "var(--space-2) 0" }}>
        Контрольно-вимірювальний інструмент
      </h1>
      <p style={{ color: "var(--color-ink-muted)" }}>128 товарів</p>

      <div className="tick-divider" style={{ margin: "var(--space-6) 0" }} />

      <div className="catalog-layout">
        {/* Фильтры — на мобильной версии это будет выезжающая панель, а не колонка */}
        <aside className="filters-panel">
          {mockFilters.map((filter) => (
            <div key={filter.name} style={{ marginBottom: "var(--space-4)" }}>
              <strong>{filter.name}</strong>
              {filter.options.map((opt) => (
                <label key={opt} style={{ display: "block", fontSize: "var(--text-sm)" }}>
                  <input type="checkbox" name={filter.name} value={opt} /> {opt}
                </label>
              ))}
            </div>
          ))}
        </aside>

        <section>
          {/* Выбранные фильтры показываются chips-тегами, чтобы легко снимать по одному */}
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <span className="badge-mark" style={{ padding: "4px 8px" }}>ANENG ✕</span>
          </div>

          <div className="product-grid">
            {mockProducts.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} className="card product-card">
                <div className="product-image-placeholder" />
                <div className="data" style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-muted)" }}>
                  Арт. {p.sku}
                </div>
                <div>{p.name}</div>
                <div>
                  <span className="price data">{p.price} ₴</span>
                  {p.oldPrice && (
                    <span
                      className="data"
                      style={{ textDecoration: "line-through", color: "var(--color-ink-muted)", marginLeft: 8 }}
                    >
                      {p.oldPrice} ₴
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
