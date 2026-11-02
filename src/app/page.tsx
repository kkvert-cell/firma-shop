import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import SearchBox from "@/components/SearchBox";
import CategoryIcon from "@/components/CategoryIcon";
import Icon from "@/components/Icon";
import { HeroArt, PromoArt } from "@/components/BrandArt";
import { SHOP_PHONE } from "@/lib/site";
import { COLLECTION_KINDS, COLLECTION_TITLES, getHomeCollections, getRunner, type CollectionKind } from "@/lib/catalog";

// force-dynamic: страница не запекается статикой при сборке (тогда список
// категорий/остатки были бы "заморожены" на момент билда) — данные
// запрашиваются заново при каждом реальном заходе посетителя.
export const dynamic = "force-dynamic";

async function loadCategories() {
  try {
    // Показываем только категории, в которых (в том числе в подкатегориях) есть видимые товары: пустые на витрине не нужны
    const rows = (await getRunner()(
      `SELECT c.id, c.name, c.slug FROM "Category" c
       WHERE c."isActive" = true AND c."parentId" IS NULL
         AND EXISTS (SELECT 1 FROM "Category" d JOIN "Product" p ON p."categoryId" = d.id
                     WHERE (d.path = c.path OR left(d.path, length(c.path) + 3) = c.path || ' > ') AND d."isActive" = true AND p."isHidden" = false)
       ORDER BY c."sortOrder" ASC`
    )) as unknown as { id: string; name: string; slug: string }[];
    return { categories: rows, error: null as string | null };
  } catch (err) {
    // Если база временно недоступна — сайт всё равно открывается,
    // просто без списка категорий, а не белым экраном ошибки.
    console.error("Не вдалося завантажити категорії:", err);
    return { categories: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function loadCollections() {
  try {
    return await getHomeCollections(getRunner());
  } catch (err) {
    console.error("Не вдалося завантажити підбірки:", err);
    return null;
  }
}

export default async function HomePage() {
  const [{ categories, error }, collections] = await Promise.all([loadCategories(), loadCollections()]);
  return (
    <main>
      {/* Главный баннер: поиск — то, чем реально будут пользоваться в первую очередь */}
      <section className="hero-banner">
        <HeroArt />
        <div className="hero-banner-body">
          <p className="eyebrow">Вимірювальний та ручний інструмент</p>
          <h1 className="heading">Знайдіть потрібний інструмент за секунди</h1>
          <p className="hero-lead">Понад 1000 товарів: вимірювальний та ручний інструмент, електроніка, аксесуари.</p>
          <SearchBox className="search-bar" placeholder="Наприклад: штангенциркуль 150 мм" />
          <div className="hero-actions">
            <Link href="/catalog" className="btn-light">Каталог</Link>
            {collections && collections.sale.length > 0 && <Link href="/collection/sale" className="btn-ghost">Акції</Link>}
          </div>
        </div>
      </section>

      {/* Промо-баннери: ведут на готовые страницы сайта */}
      <section className="promo-grid" aria-label="Пропозиції">
        {collections && collections.sale.length > 0 && (
          <Link href="/collection/sale" className="promo promo-sale">
            <span className="promo-text"><strong>Акції та знижки</strong><span>Товари зі зниженою ціною</span></span>
            <PromoArt kind="sale" />
          </Link>
        )}
        <a href={`tel:${SHOP_PHONE}`} className="promo promo-business">
          <span className="promo-text"><strong>Для бізнесу</strong><span>Безготівковий розрахунок для юросіб і ФОП. Зателефонуйте, підготуємо рахунок</span></span>
          <PromoArt kind="business" />
        </a>
        <Link href="/info/delivery-and-payment" className="promo promo-delivery">
          <span className="promo-text"><strong>Доставка по Україні</strong><span>Нова пошта та Укрпошта</span></span>
          <PromoArt kind="delivery" />
        </Link>
      </section>

      <div className="tick-divider" style={{ margin: "var(--space-8) 0" }} />

      {/* Каталог категорий — второй по важности вход в сайт */}
      <section>
        <h2 className="heading" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          Категорії
        </h2>
        <div className="category-grid">
          {categories.length === 0 && (
            <p style={{ color: "var(--color-ink-muted)" }}>
              Категорії тимчасово недоступні.
              {error && (
                <span style={{ display: "block", color: "var(--color-error)", fontSize: "var(--text-sm)" }}>
                  (тимчасово для налагодження: {error})
                </span>
              )}
            </p>
          )}
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/catalog/${cat.slug}`} className="card category-card">
              <span className="category-icon"><CategoryIcon name={cat.name} /></span>
              <span>{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Подборки «Акции», «Хиты», «Новинки»: пустые не показываем */}
      {collections &&
        COLLECTION_KINDS.filter((k: CollectionKind) => collections[k].length > 0).map((k: CollectionKind) => (
          <section key={k} className="home-block">
            <div className="home-block-head">
              <h2 className="heading" style={{ fontSize: "var(--text-xl)" }}>{COLLECTION_TITLES[k]}</h2>
              <Link href={`/collection/${k}`}>Усі →</Link>
            </div>
            <div className="product-row">
              {collections[k].map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        ))}

      <div className="tick-divider" style={{ margin: "var(--space-8) 0" }} />

      {/* Доверие: контакты и условия — важно для B2C и B2B клиентов сразу */}
      <section className="trust-bar">
        <div>
          <span className="category-icon"><Icon name="truck" /></span>
          <span><strong>Доставка по Україні</strong><p>Нова пошта, Укрпошта</p></span>
        </div>
        <div>
          <span className="category-icon"><Icon name="card" /></span>
          <span><strong>Оплата</strong><p>Онлайн, накладений платіж, безнал для юросіб</p></span>
        </div>
        <div>
          <span className="category-icon"><Icon name="clock" /></span>
          <span><strong>Працюємо</strong><p>Пн–Пт 09:00–19:00, Сб–Нд 10:00–18:00</p></span>
        </div>
      </section>
    </main>
  );
}
