"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/site";
import { thumb } from "@/lib/image";
import type { Suggestions } from "@/lib/search-suggest";

type Option = { key: string; href: string; kind: "product" | "category" | "all"; label: string; sub?: string; image?: string | null; price?: number; oldPrice?: number | null; inStock?: boolean };

// Строка поиска с подсказками: товары, категории и «показать все результаты». Работает и без JavaScript (обычная форма поиска).
export default function SearchBox({ className, placeholder }: { className: string; placeholder: string }) {
  const router = useRouter();
  const uid = useId();
  const listId = `${uid}-list`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const term = q.trim();

  // запрос подсказок: с небольшой задержкой, предыдущий незавершённый запрос отменяется
  useEffect(() => {
    if (term.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setData(await res.json());
          setActive(-1);
        }
      } catch {
        /* запрос отменён или нет связи: подсказок просто не будет */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  // закрываем список при клике вне поля
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const options: Option[] = [];
  if (data) {
    for (const p of data.products) options.push({ key: `p-${p.slug}`, href: `/product/${p.slug}`, kind: "product", label: p.name, image: p.image, price: p.price, oldPrice: p.oldPrice, inStock: p.isAvailable });
    for (const c of data.categories) options.push({ key: `c-${c.slug}`, href: `/catalog/${c.slug}`, kind: "category", label: c.name, sub: c.path.split(" > ").slice(0, -1).join(" › ") });
    if (data.products.length > 0) options.push({ key: "all", href: `/search?q=${encodeURIComponent(term)}`, kind: "all", label: `Показати всі результати (${data.total})` });
  }
  const show = open && term.length >= 2 && (data !== null || loading);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return setOpen(false);
    if (!options.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % options.length : (a <= 0 ? options.length : a) - 1));
    } else if (e.key === "Enter" && active >= 0 && show) {
      e.preventDefault();
      go(options[active].href);
    }
  };

  return (
    <div className={`search-wrap ${className}`} ref={wrapRef}>
      <form action="/search" role="search" className="search-form" onSubmit={() => setOpen(false)}>
        <input
          type="search"
          name="q"
          value={q}
          placeholder={placeholder}
          aria-label="Пошук товарів"
          autoComplete="off"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${uid}-o${active}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="btn-primary">Знайти</button>
      </form>

      {show && (
        <ul id={listId} role="listbox" className="suggest-list">
          {options.length === 0 && (
            <li className="suggest-hint" role="presentation">{loading ? "Шукаємо…" : "Нічого не знайдено. Спробуйте коротше слово або артикул."}</li>
          )}
          {options.map((o, i) => (
            <li key={o.key} role="presentation">
              <Link
                id={`${uid}-o${i}`}
                role="option"
                aria-selected={i === active}
                href={o.href}
                className={`suggest-item suggest-${o.kind}${i === active ? " active" : ""}`}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setActive(i)}
              >
                {o.kind === "product" && (o.image ? <img src={thumb(o.image, 100)} alt="" width={40} height={40} loading="lazy" /> : <span className="suggest-noimg" aria-hidden="true" />)}
                <span className="suggest-text">
                  <span className="suggest-name">{o.label}</span>
                  {o.kind === "category" && <span className="suggest-sub">Категорія{o.sub ? ` · ${o.sub}` : ""}</span>}
                  {o.kind === "product" && (
                    <span className="suggest-sub">
                      {o.price && o.price > 0 ? `${formatPrice(o.price)} ₴` : "Ціну уточнюйте"}
                      {o.oldPrice && o.price && o.oldPrice > o.price ? <s className="suggest-old"> {formatPrice(o.oldPrice)} ₴</s> : null}
                      {o.inStock ? "" : " · немає в наявності"}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
