import Link from "next/link";
import { getSql } from "@/lib/db";

// force-dynamic: страница не запекается статикой при сборке (тогда список
// категорий/остатки были бы "заморожены" на момент билда) — данные
// запрашиваются заново при каждом реальном заходе посетителя.
export const dynamic = "force-dynamic";

async function loadCategories() {
  try {
    const sql = getSql();
    return (await sql`
      SELECT id, name, slug FROM "Category"
      WHERE "isActive" = true
      ORDER BY "sortOrder" ASC
    `) as { id: string; name: string; slug: string }[];
  } catch (err) {
    // Если база временно недоступна — сайт всё равно открывается,
    // просто без списка категорий, а не белым экраном ошибки.
    console.error("Не вдалося завантажити категорії:", err);
    return [];
  }
}

export default async function HomePage() {
  const categories = await loadCategories();
  return (
    <main>
      {/* Hero: поиск — это то, чем реально будут пользоваться в первую очередь */}
      <section className="hero">
        <h1 className="heading" style={{ fontSize: "var(--text-3xl)" }}>
          Знайдіть потрібний інструмент за секунди
        </h1>
        <p style={{ color: "var(--color-ink-muted)", maxWidth: "var(--max-line)" }}>
          Понад 1000 товарів: вимірювальний та ручний інструмент, електроніка, аксесуари.
        </p>

        <form action="/search" className="search-bar" role="search">
          <input
            type="text"
            name="q"
            placeholder="Наприклад: штангенциркуль 150 мм"
            aria-label="Пошук товарів"
          />
          <button type="submit" className="btn-primary">Знайти</button>
        </form>
      </section>

      <div className="tick-divider" style={{ margin: "var(--space-8) 0" }} />

      {/* Каталог категорий — второй по важности вход в сайт */}
      <section>
        <h2 className="heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          Категорії
        </h2>
        <div className="category-grid">
          {categories.length === 0 && (
            <p style={{ color: "var(--color-ink-muted)" }}>Категорії тимчасово недоступні.</p>
          )}
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/catalog/${cat.slug}`} className="card category-card">
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      <div className="tick-divider" style={{ margin: "var(--space-8) 0" }} />

      {/* Доверие: контакты и условия — важно для B2C и B2B клиентов сразу */}
      <section className="trust-bar">
        <div>
          <strong>Доставка по Україні</strong>
          <p>Нова пошта, Укрпошта</p>
        </div>
        <div>
          <strong>Оплата</strong>
          <p>Онлайн, накладений платіж, безнал для юросіб</p>
        </div>
        <div>
          <strong>Працюємо</strong>
          <p>Пн–Пт 09:00–19:00, Сб–Нд 10:00–18:00</p>
        </div>
      </section>
    </main>
  );
}
