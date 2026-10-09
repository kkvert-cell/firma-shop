import Link from "next/link";

// Постраничная навигация обычными ссылками (их видят и поисковики).
export default function Pagination({
  basePath,
  query,
  page,
  total,
  perPage,
}: {
  basePath: string;
  query: URLSearchParams;
  page: number;
  total: number;
  perPage: number;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const href = (n: number) => {
    const q = new URLSearchParams(query);
    if (n > 1) q.set("page", String(n));
    else q.delete("page");
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // Показываем: первая, последняя и окно вокруг текущей
  const shown: (number | "gap")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) shown.push(n);
    else if (shown[shown.length - 1] !== "gap") shown.push("gap");
  }

  return (
    <nav className="pagination" aria-label="Сторінки">
      {page > 1 && <Link href={href(page - 1)} rel="prev">← Назад</Link>}
      {shown.map((n, i) =>
        n === "gap" ? (
          <span key={`g${i}`} className="gap">…</span>
        ) : (
          <Link key={n} href={href(n)} className={n === page ? "current" : undefined} aria-current={n === page ? "page" : undefined}>
            {n}
          </Link>
        )
      )}
      {page < pages && <Link href={href(page + 1)} rel="next">Далі →</Link>}
    </nav>
  );
}
