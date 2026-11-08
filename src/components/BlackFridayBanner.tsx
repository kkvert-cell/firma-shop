import Link from "next/link";
import { plural } from "@/lib/site";
import { BF_PERIOD_TEXT, BF_TERMS_HREF, BF_TO_TEXT, bfDaysLeft } from "@/lib/blackfriday";

// Ціники-ілюстрація: три нахилені цінники з відсотками
function TagsArt() {
  const tag = "M-40,-30 H48 a8,8 0 0 1 8,8 V22 a8,8 0 0 1 -8,8 H-40 L-62,0 Z";
  return (
    <svg className="bf-art" viewBox="0 0 310 190" role="img" aria-label="Цінники зі знижками" focusable="false">
      <circle cx="160" cy="95" r="84" fill="#FFE9A6" />
      <circle cx="268" cy="28" r="7" fill="#FFC400" />
      <circle cx="40" cy="150" r="5" fill="#133249" />
      <circle cx="288" cy="168" r="4" fill="#FFC400" />
      <path d="M24 40l6 12 12 6-12 6-6 12-6-12-12-6 12-6z" fill="#FFC400" />
      <g transform="translate(168 58) rotate(-12)">
        <path d={tag} fill="#FFC400" />
        <circle cx="-40" cy="0" r="5" fill="#FFF6D6" />
        <text x="10" y="8" textAnchor="middle" fontSize="24" fontWeight="800" fill="#0F2335">−30%</text>
      </g>
      <g transform="translate(124 128) rotate(7)">
        <path d={tag} fill="#133249" />
        <circle cx="-40" cy="0" r="5" fill="#FFF6D6" />
        <text x="10" y="8" textAnchor="middle" fontSize="24" fontWeight="800" fill="#FFC400">−20%</text>
      </g>
      <g transform="translate(240 140) rotate(-5)">
        <path d={tag} fill="#FFFFFF" stroke="#133249" strokeWidth="2.5" />
        <circle cx="-40" cy="0" r="5" fill="#FFF6D6" stroke="#133249" strokeWidth="1.5" />
        <text x="10" y="8" textAnchor="middle" fontSize="24" fontWeight="800" fill="#133249">−15%</text>
      </g>
    </svg>
  );
}

// Світлий банер акції. variant="home" — на головній, "page" — шапка сторінки акцій з короткими умовами.
export default function BlackFridayBanner({ variant }: { variant: "home" | "page" }) {
  const left = bfDaysLeft();
  const leftText = left <= 1 ? "Останній день!" : `Залишилось ${left} ${plural(left, ["день", "дні", "днів"])}`;
  const run = `ЧОРНА П'ЯТНИЦЯ ✦ ЗНИЖКИ ДО ${BF_TO_TEXT} ✦ `.repeat(6);
  return (
    <section className={`bf-banner bf-banner-${variant}`} aria-label="Чорна п'ятниця">
      <div className="bf-body">
        <div className="bf-banner-main">
          <p className="bf-eyebrow"><span className="bf-tag">{BF_PERIOD_TEXT}</span> <span className="bf-left">{leftText}</span></p>
          {variant === "home" ? <p className="bf-title">Чорна п&apos;ятниця</p> : <h1 className="bf-title">Чорна п&apos;ятниця</h1>}
          <p className="bf-lead">Знижки на інструмент і електроніку. Стара й нова ціна поруч, дата завершення знижки біля кожного товару.</p>
          <div className="bf-actions">
            {variant === "home" && <Link href="/collection/sale" className="bf-btn">Дивитись акції</Link>}
            <Link href={BF_TERMS_HREF} className="bf-link">Умови акції</Link>
          </div>
          {variant === "page" && (
            <ul className="bf-points">
              <li>Знижка діє до дати, вказаної біля товару.</li>
              <li>Лише в кількості, що є в наявності.</li>
              <li>Ціна фіксується на момент оформлення замовлення.</li>
              <li>Знижки різних акцій не сумуються.</li>
            </ul>
          )}
        </div>
        <TagsArt />
      </div>
      <div className="bf-marquee" aria-hidden="true">
        <div className="bf-marquee-track"><span>{run}</span><span>{run}</span></div>
      </div>
    </section>
  );
}
