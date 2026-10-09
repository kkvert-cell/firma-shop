import Link from "next/link";

export default function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Навігація" className="breadcrumbs">
      <Link href="/">Головна</Link>
      {items.map((it, i) => (
        <span key={i}>
          <span className="sep">/</span>
          {it.href ? <Link href={it.href}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}
        </span>
      ))}
    </nav>
  );
}
