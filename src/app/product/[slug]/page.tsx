import Link from "next/link";

// В реальном проекте товар придёт из БД по slug'у, характеристики (attributes)
// выводятся динамически из ProductAttributeValue (EAV) — здесь для наглядности
// они прописаны как массив.

const product = {
  name: "Штангенциркуль цифровий 150 мм",
  sku: "SVR-150",
  brand: "ANENG",
  price: 349,
  oldPrice: 429,
  available: true,
  description:
    "Цифровий штангенциркуль з РК-дисплеєм для точних вимірювань зовнішніх, внутрішніх розмірів і глибини.",
  attributes: [
    { name: "Діапазон вимірювання", value: "0–150 мм" },
    { name: "Точність", value: "±0.02 мм" },
    { name: "Матеріал", value: "Нержавіюча сталь" },
    { name: "Живлення", value: "Батарейка CR2032" },
  ],
};

export default function ProductPage() {
  return (
    <main>
      <nav aria-label="breadcrumbs" style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
        <Link href="/">Головна</Link> /{" "}
        <Link href="/catalog/izmeritelnyj-instrument">Контрольно-вимірювальний інструмент</Link> /{" "}
        {product.name}
      </nav>

      <div className="product-detail-layout" style={{ marginTop: "var(--space-6)" }}>
        {/* Галерея — заглушка, реально будет карусель с zoom */}
        <div className="product-gallery">
          <div className="product-image-placeholder" style={{ aspectRatio: "1 / 1" }} />
        </div>

        <div>
          <div className="data" style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
            Арт. {product.sku} · {product.brand}
          </div>
          <h1 className="heading" style={{ fontSize: "var(--text-2xl)", margin: "var(--space-2) 0" }}>
            {product.name}
          </h1>

          <div style={{ margin: "var(--space-4) 0" }}>
            <span className="price data" style={{ fontSize: "var(--text-xl)" }}>{product.price} ₴</span>
            {product.oldPrice && (
              <span
                className="data"
                style={{ textDecoration: "line-through", color: "var(--color-ink-muted)", marginLeft: 8 }}
              >
                {product.oldPrice} ₴
              </span>
            )}
          </div>

          <p style={{ color: product.available ? "var(--color-success)" : "var(--color-error)" }}>
            {product.available ? "В наявності" : "Немає в наявності"}
          </p>

          <div style={{ display: "flex", gap: "var(--space-2)", margin: "var(--space-4) 0" }}>
            <button className="btn-primary" style={{ padding: "10px 20px" }}>Додати в кошик</button>
            <button className="card" style={{ padding: "10px 20px" }}>Купити в 1 клік</button>
          </div>

          <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)" }}>
            <button>☆ В обране</button>
            <button>⇄ Порівняти</button>
          </div>

          {/* B2B-блок: то самое требование про запрос счёта для юрлиц */}
          <div className="card" style={{ padding: "var(--space-4)", marginTop: "var(--space-6)" }}>
            <strong>Купуєте для компанії?</strong>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
              Замовте рахунок або комерційну пропозицію на реквізити компанії.
            </p>
            <button className="btn-primary" style={{ marginTop: "var(--space-2)", padding: "8px 16px" }}>
              Запросити рахунок
            </button>
          </div>

          <div className="tick-divider" style={{ margin: "var(--space-6) 0" }} />

          <h2 className="heading" style={{ fontSize: "var(--text-lg)" }}>Характеристики</h2>
          <table style={{ width: "100%", fontSize: "var(--text-sm)" }}>
            <tbody>
              {product.attributes.map((attr) => (
                <tr key={attr.name} style={{ borderBottom: "var(--border-hairline)" }}>
                  <td style={{ padding: "6px 0", color: "var(--color-ink-muted)" }}>{attr.name}</td>
                  <td className="data" style={{ padding: "6px 0" }}>{attr.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: "var(--space-6)" }}>{product.description}</p>
        </div>
      </div>
    </main>
  );
}
