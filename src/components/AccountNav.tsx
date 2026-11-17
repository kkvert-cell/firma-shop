import Link from "next/link";

const TABS = [
  { id: "orders", href: "/account", label: "Замовлення" },
  { id: "profile", href: "/account/profile", label: "Профіль" },
  { id: "addresses", href: "/account/addresses", label: "Адреси" },
  { id: "wishlist", href: "/wishlist", label: "Обране" },
];

// Вкладки особистого кабінету
export default function AccountNav({ active }: { active: string }) {
  return (
    <nav className="account-nav" aria-label="Розділи кабінету">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} className={`chip${t.id === active ? " chip-active" : ""}`} aria-current={t.id === active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
