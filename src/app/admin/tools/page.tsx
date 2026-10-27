import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Службові сторінки (синхронізація з Prom і KeyCRM). Вони захищені паролем SYNC_SECRET; тут вони під рукою,
// щоб не запам'ятовувати адреси. Посилання бачите лише ви, після входу.
export default async function AdminTools() {
  await requireAdmin();
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
