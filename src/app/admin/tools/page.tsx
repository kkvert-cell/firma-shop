import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { fmtDate } from "@/lib/admin-format";
import { loadPromState } from "@/lib/prom-refresh";

export const dynamic = "force-dynamic";

// Службові сторінки (синхронізація з Prom і KeyCRM). Вони захищені паролем SYNC_SECRET; тут вони під рукою,
// щоб не запам'ятовувати адреси. Посилання бачите лише ви, після входу.
export default async function AdminTools({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const { ok } = await searchParams;
  const prom = await loadPromState(getRunner());
  const key = encodeURIComponent(process.env.SYNC_SECRET ?? "");
  const tools = [
    { href: `/api/sync/keycrm?key=${key}&status=1`, title: "Стан синхронізації залишків", text: "Скільки товарів отримали залишок із KeyCRM і коли було останнє оновлення." },
    { href: `/api/sync/prom?key=${key}`, title: "Оновити каталог з Prom", text: "Завантажує картки товарів порціями; повторний запуск безпечний. Натискайте, поки не напише, що все завантажено." },
    { href: `/api/sync/articles?key=${key}`, title: "Підв'язати артикули", text: "Зв'язує товари з артикулами для обміну з KeyCRM." },
    { href: `/api/orders/list?key=${key}`, title: "Простий список замовлень", text: "Старий текстовий список (все те саме є в розділі «Замовлення»)." },
    { href: `/api/keycrm/probe?key=${key}`, title: "Довідники KeyCRM", text: "Джерела замовлень і служби доставки: для налаштування й перевірки." },
  ];
  return (
    <main className="adm-main">
      <h1 className="heading page-title">Інструменти</h1>
      {ok === "refresh" && <p className="notice">Готово: оновлення каталогу почнеться протягом 10 хвилин.</p>}
      <section className="card adm-block">
        <h2 className="heading section-title">Каталог з Prom</h2>
        <p>
          {prom.active
            ? `Зараз іде оновлення: оброблено ${Math.min(prom.cursor, prom.total)} із ${prom.total || "…"} товарів.`
            : prom.lastDone
            ? `Останнє повне оновлення: ${fmtDate(prom.lastDone)} (київський час).`
            : "Повне оновлення ще не запускалось."}
          {prom.fails > 0 ? ` Невдалих спроб поспіль: ${prom.fails}.` : ""}
        </p>
        <p className="muted small">Ціни, назви, фото й нові товари оновлюються автоматично приблизно двічі на добу. Залишки — з KeyCRM, кожні кілька хвилин.</p>
        <form action="/api/admin/catalog/refresh" method="post">
          <button type="submit" className="btn-primary">Оновити зараз</button>
        </form>
      </section>
      <ul className="adm-list">
        {tools.map((t) => (
          <li key={t.href}>
            <a href={t.href} className="adm-row" target="_blank" rel="noreferrer">
              <span className="adm-row-main">{t.title}</span>
              <span className="adm-row-sub">{t.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
