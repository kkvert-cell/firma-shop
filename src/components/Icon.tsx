// Набор значков в стиле сайта (линейные, 24×24). Используются в блоках преимуществ и на странице товара.
export type IconName = "truck" | "card" | "shield" | "return" | "phone" | "percent" | "doc" | "check" | "clock";

const PATHS: Record<IconName, React.ReactNode> = {
  truck: (<><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7" /><circle cx="6.5" cy="17" r="1.8" /><circle cx="16.5" cy="17" r="1.8" /></>),
  card: (<><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>),
  shield: (<><path d="M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5L15.5 10" /></>),
  return: (<><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v5h5" /></>),
  phone: (<><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>),
  percent: (<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="17" r="2.4" /></>),
  doc: (<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>),
  check: (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
};

export default function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
