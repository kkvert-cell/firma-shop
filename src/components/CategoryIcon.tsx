// Небольшие линейные значки для плиток категорий на главной (подбираются по названию категории)
const ICONS: { test: RegExp; paths: React.ReactNode }[] = [
  { test: /вимір|мірил|калібр|штанген|рулетк|рівен|лінійк/i, paths: (<><rect x="3" y="8" width="18" height="8" rx="1" /><path d="M7 8v4M11 8v3M15 8v4M19 8v3" /></>) },
  { test: /електрон|електро|гаджет|ліхтар|акумул|зарядн|кабел|лазер|дальномір/i, paths: (<><rect x="6" y="6" width="12" height="12" rx="1" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>) },
  { test: /аксесуар|сумк|рюкзак|одяг|взутт|рукавич|окуляр|захист/i, paths: (<><path d="M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0" /></>) },
  { test: /ручн|інструмент|ключ|викрут|пл[ое]ск|кліщ|молот|пил/i, paths: (<><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6z" /></>) },
];
const DEFAULT = (<><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>);

export default function CategoryIcon({ name }: { name: string }) {
  const icon = ICONS.find((i) => i.test.test(name));
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon ? icon.paths : DEFAULT}
    </svg>
  );
}
