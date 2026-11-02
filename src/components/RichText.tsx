import { parseDescription } from "@/lib/text-format";

// Оформленный текст: абзацы, списки, подзаголовки и таблица «характеристика — значение»
export default function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const blocks = parseDescription(text);
  if (!blocks.length) return null;
  return (
    <div className={`rt ${className}`} lang="uk">
      {blocks.map((b, i) => {
        if (b.t === "p") return <p key={i}>{b.lines.map((l, j) => (j === 0 ? l : [<br key={`b${j}`} />, l]))}</p>;
        if (b.t === "h") return <h3 key={i}>{b.text}</h3>;
        if (b.t === "ul") return <ul key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
        if (b.t === "ol") return <ol key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>;
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
