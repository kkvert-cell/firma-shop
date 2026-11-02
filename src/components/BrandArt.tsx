// Фирменная графика в стиле логотипа: серебристые косые плиты, дуга циферблата и деления измерительной шкалы.
// Чистая векторная графика: не весит почти ничего и чёткая на любом экране.

const GRAD = (
  <linearGradient id="ba-silver" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stopColor="#A3AAB0" />
    <stop offset="0.55" stopColor="#E6E9EC" />
    <stop offset="1" stopColor="#8F969D" />
  </linearGradient>
);

function Ticks({ x = 20, y = 404, count = 58, step = 10, color = "#fff", opacity = 0.35 }: { x?: number; y?: number; count?: number; step?: number; color?: string; opacity?: number }) {
  return (
    <g stroke={color} opacity={opacity} strokeWidth="1.5">
      {Array.from({ length: count }, (_, i) => (
        <line key={i} x1={x + i * step} x2={x + i * step} y1={y} y2={y - (i % 10 === 0 ? 20 : i % 5 === 0 ? 14 : 8)} />
      ))}
    </g>
  );
}

// Большая графика для главного баннера
export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 640 420" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
      <defs>{GRAD}</defs>
      {/* дуга-«циферблат» */}
      <g fill="none" stroke="#C9CED3">
        <path d="M470 40 A150 150 0 0 1 620 190" strokeWidth="14" opacity="0.85" />
        <path d="M448 62 A122 122 0 0 1 598 212" strokeWidth="3" opacity="0.6" />
        <path d="M590 150 L620 162 M575 118 L604 134 M552 90 L578 112" strokeWidth="4" opacity="0.7" />
      </g>
      {/* серебристая планка и «клин» из логотипа */}
      <polygon points="300,300 640,300 640,226 372,226" fill="url(#ba-silver)" opacity="0.95" />
      <polygon points="372,226 640,226 640,208 392,208" fill="#fff" opacity="0.10" />
      <polygon points="250,420 330,300 410,300 340,420" fill="url(#ba-silver)" opacity="0.9" />
      <polygon points="430,420 520,300 640,300 640,420" fill="#fff" opacity="0.06" />
      <Ticks />
    </svg>
  );
}

// Небольшие картинки для промо-баннеров
export function PromoArt({ kind }: { kind: "sale" | "business" | "delivery" }) {
  const dark = kind !== "business";
  const stroke = dark ? "#fff" : "#133249";
  return (
    <svg className="promo-art" viewBox="0 0 160 120" aria-hidden="true" focusable="false">
      <defs>{GRAD}</defs>
      <polygon points="40,120 90,50 160,50 160,120" fill="url(#ba-silver)" opacity={dark ? 0.28 : 0.55} />
      <polygon points="70,120 112,64 160,64 160,76 124,120" fill={dark ? "#fff" : "#133249"} opacity={dark ? 0.1 : 0.08} />
      <g fill="none" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" transform="translate(70 18) scale(3.4)">
        {kind === "sale" && (<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="17" r="2.4" /></>)}
        {kind === "business" && (<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>)}
        {kind === "delivery" && (<><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7" /><circle cx="6.5" cy="17" r="1.8" /><circle cx="16.5" cy="17" r="1.8" /></>)}
      </g>
      <Ticks x={8} y={116} count={14} step={9} color={stroke} opacity={0.3} />
    </svg>
  );
}
