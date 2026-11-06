import Link from "next/link";
import CategoryIcon from "./CategoryIcon";
import SmartImage from "./SmartImage";
import { thumb } from "@/lib/image";
import { plural } from "@/lib/site";

export type GroupCardData = { id: string; name: string; slug: string; n: number; image: string | null; children: { id: string; name: string; slug: string; n: number }[] };

// Великі картки головних груп: фото, назва, кількість товарів і кілька підгруп-посилань
export default function GroupCards({ groups, showSubs = true }: { groups: GroupCardData[]; showSubs?: boolean }) {
  return (
    <div className="group-grid">
      {groups.map((g) => {
        const shown = g.children.slice(0, 4);
        const rest = g.children.length - shown.length;
        return (
          <article key={g.id} className="group-card">
            <Link href={`/catalog/${g.slug}`} className="group-card-main">
              <span className="group-card-img">
                {g.image ? <SmartImage src={thumb(g.image, 360)} fallback={g.image} alt="" /> : <span className="group-card-ph"><CategoryIcon name={g.name} /></span>}
              </span>
              <span className="group-card-name">{g.name}</span>
              <span className="group-card-n">{g.n} {plural(g.n, ["товар", "товари", "товарів"])}</span>
            </Link>
            {showSubs && shown.length > 0 && (
              <ul className="group-card-subs">
                {shown.map((c) => (
                  <li key={c.id}><Link href={`/catalog/${c.slug}`}>{c.name}</Link></li>
                ))}
                {rest > 0 && <li className="more"><Link href={`/catalog/${g.slug}`}>ще {rest}</Link></li>}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
