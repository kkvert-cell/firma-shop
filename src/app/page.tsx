import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import SearchBox from "@/components/SearchBox";
import Icon from "@/components/Icon";
import { HeroArt, PromoArt } from "@/components/BrandArt";
import { SHOP_PHONE } from "@/lib/site";
import GroupCards from "@/components/GroupCards";
import HomeCollections from "@/components/HomeCollections";
import BlackFridayBanner from "@/components/BlackFridayBanner";
import { isBlackFriday } from "@/lib/blackfriday";
import { COLLECTION_KINDS, COLLECTION_TITLES, getHomeCollections, getRunner, getTopCategoriesWithChildren, type CollectionKind } from "@/lib/catalog";

// force-dynamic: страница не запекается статикой при сборке (тогда список
// категорий/остатки были бы "заморожены" на момент билда) — данные
// запрашиваются заново при каждом реальном заходе посетителя.
export const dynamic = "force-dynamic";

async function loadCategories() {
  try {
    // Лише групи, в яких (разом з вкладеними) є видимі товари: порожні на вітрині не потрібні
    return { categories: await getTopCategoriesWithChildren(getRunner()), error: null as string | null };
  } catch (err) {
    // Якщо база тимчасово недоступна — сайт усе одно відкривається, просто без списку груп
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
  const bf = isBlackFriday();
  const nonEmpty = collections ? COLLECTION_KINDS.filter((k: CollectionKind) => collections[k].length > 0) : [];
  return (
    <main className={bf ? "bf-on" : undefined}>
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
            {collections && collections.sale.length > 0 && <Link href="/collection/sale" className="btn-ghost">{bf ? "Чорна п'ятниця" : "Акції"}</Link>}
          </div>
        </div>
      </section>

      {bf && collections && collections.sale.length > 0 && <BlackFridayBanner variant="home" />}

      {/* Промо-баннери: ведут на готовые страницы сайта */}
      <section className="promo-grid" aria-label="Пропозиції">
        {collections && collections.sale.length > 0 && (
          <Link href="/collection/sale" className={bf ? "promo promo-sale promo-bf" : "promo promo-sale"}>
            <span className="promo-text"><strong>{bf ? "Чорна п'ятниця" : "Акції та знижки"}</strong><span>{bf ? "Знижки до 29.11" : "Товари зі зниженою ціною"}</span></span>
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
        {categories.length === 0 && (
          <p style={{ color: "var(--color-ink-muted)" }}>
            Категорії тимчасово недоступні.
            {error && <span style={{ display: "block", color: "var(--color-error)", fontSize: "var(--text-sm)" }}>(тимчасово для налагодження: {error})</span>}
          </p>
        )}
        <GroupCards groups={categories} showSubs={false} />
      </section>

      {/* Підбірки «Акції», «Хіти», «Новинки»: порожні не показуємо. Якщо непорожня лише одна — старий вигляд зі стрічкою */}
      {collections && nonEmpty.length >= 2 && <HomeCollections data={collections} kinds={nonEmpty} bf={bf} />}
      {collections && nonEmpty.length === 1 && nonEmpty.map((k: CollectionKind) => (
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
