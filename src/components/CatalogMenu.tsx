"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type MenuGroup = { id: string; name: string; slug: string; n: number; children: { id: string; name: string; slug: string; n: number }[] };

// Меню «Каталог»: на комп'ютері випадає панель (групи ліворуч, підгрупи праворуч), на телефоні — шторка зі списком, що розгортається.
export default function CatalogMenu({ groups }: { groups: MenuGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (groups.length === 0) return null;
  const current = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <div className="cat-menu">
      <button type="button" className="cat-menu-btn" aria-expanded={open} aria-controls="cat-menu-panel" onClick={() => setOpen((v) => !v)}>
        <span className="cat-menu-burger" aria-hidden="true"><i /><i /><i /></span>
        Каталог
      </button>
      {open && (
        <>
          <div className="cat-menu-backdrop" onClick={close} />
          <div id="cat-menu-panel" className="cat-menu-panel" role="dialog" aria-label="Каталог товарів">
            <div className="cat-menu-top">
              <strong>Каталог</strong>
              <button type="button" className="cat-menu-close" aria-label="Закрити меню" onClick={close}>✕</button>
            </div>
            <div className="cat-menu-body">
              <ul className="cat-menu-groups">
                {groups.map((g) => (
                  <li key={g.id} className={g.id === current.id ? "is-active" : undefined}>
                    <div className="cat-menu-row">
                      <Link href={`/catalog/${g.slug}`} className="cat-menu-group" onMouseEnter={() => setActive(g.id)} onFocus={() => setActive(g.id)}>
                        <span>{g.name}</span>
                        <span className="cat-menu-n">{g.n}</span>
                      </Link>
                      {g.children.length > 0 && (
                        <button
                          type="button"
                          className="cat-menu-chev"
                          aria-label={`Підгрупи: ${g.name}`}
                          aria-expanded={active === g.id}
                          onClick={() => setActive(active === g.id ? null : g.id)}
                        >
                          ▾
                        </button>
                      )}
                    </div>
                    {active === g.id && g.children.length > 0 && (
                      <ul className="cat-menu-kids">
                        {g.children.map((c) => (
                          <li key={c.id}><Link href={`/catalog/${c.slug}`}>{c.name} <span className="cat-menu-n">{c.n}</span></Link></li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              <div className="cat-menu-sub">
                <Link href={`/catalog/${current.slug}`} className="cat-menu-sub-title">{current.name} →</Link>
                <ul>
                  {current.children.map((c) => (
                    <li key={c.id}><Link href={`/catalog/${c.slug}`}>{c.name} <span className="cat-menu-n">{c.n}</span></Link></li>
                  ))}
                </ul>
                {current.children.length === 0 && <p className="muted small">У цій групі немає підгруп.</p>}
              </div>
            </div>
            <div className="cat-menu-foot"><Link href="/catalog">Усі групи</Link></div>
          </div>
        </>
      )}
    </div>
  );
}
