import { parseDescription } from "@/lib/text-format";

// Оформленный текст: абзацы, списки, подзаголовки и таблица «характеристика — значение»
// Строки с цепочкой значений через слеш («600 мА/6 А/10 А ± (1% + 5)») почти не имеют мест для переноса:
// по ширине они растягиваются «дырами», поэтому такие пункты выравниваем по левому краю
const chain = (x: string) => (x.match(/\/\u200B/g) ?? []).length >= 1;

export default function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const blocks = parseDescription(text);
  if (!blocks.length) return null;
  return (
    <div className={`rt ${className}`} lang="uk">
      {blocks.map((b, i) => {
        if (b.t === "p") return <p key={i}>{b.lines.map((l, j) => (j === 0 ? l : [<br key={`b${j}`} />, l]))}</p>;
        if (b.t === "h") return <h3 key={i}>{b.text}</h3>;
        if (b.t === "ul") return <ul key={i}>{b.items.map((x, j) => <li key={j} className={chain(x) ? "nj" : undefined}>{x}</li>)}</ul>;
        if (b.t === "ol") return <ol key={i}>{b.items.map((x, j) => <li key={j} className={chain(x) ? "nj" : undefined}>{x}</li>)}</ol>;
        if (b.t === "table")
          return (
            <div key={i} className="spec-wrap">
              <table className="spec">
                {b.caption && <caption>{b.caption}</caption>}
                <thead>
                  <tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          );
        return (
          <dl key={i}>
            {b.rows.map(([k, v], j) => (
              <div key={j}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        );
      })}
    </div>
  );
}
