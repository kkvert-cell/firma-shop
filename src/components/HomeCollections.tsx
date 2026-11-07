import Link from "next/link";
import SmartImage from "./SmartImage";
import { thumb } from "@/lib/image";
import { formatPrice } from "@/lib/site";
import { COLLECTION_TITLES, COLLECTION_ALL_LABELS } from "@/lib/collections-ui";
import type { ProductCardData } from "@/lib/catalog";

type Kind = "sale" | "hits" | "new";
const PER_COLUMN = 4;

function Row({ p, kind }: { p: ProductCardData; kind: Kind }) {
  const hasOld = !!p.oldPrice && p.oldPrice > p.price && p.price > 0;
  const off = hasOld ? Math.round(((p.oldPrice! - p.price) / p.oldPrice!) * 100) : 0;
  return (
    <Link href={`/product/${p.slug}`} className="hc-row">
      <span className="hc-thumb">
        {kind === "sale" && hasOld && <span className="hc-badge hc-badge-sale">−{off}%</span>}
        {kind === "hits" && <span className="hc-badge hc-badge-hit">Хіт</span>}
        {kind === "new" && <span className="hc-badge hc-badge-new">Нове</span>}
        {p.image ? <SmartImage src={thumb(p.image, 160)} fallback={p.image} alt="" /> : null}
      </span>
      <span className="hc-info">
        <span className="hc-name">{p.name}</span>
        <span className="hc-price-row">
          {p.price > 0 ? (
            <>
              <span className="price data">{formatPrice(p.price)} ₴</span>
              {hasOld && <span className="old-price data">{formatPrice(p.oldPrice!)} ₴</span>}
            </>
          ) : (
            <span className="stock-out">Ціну уточнюйте</span>
          )}
        </span>
        {kind === "sale" && hasOld && p.saleUntil && <span className="sale-until">Акція до {p.saleUntil.slice(0, 5)}</span>}
      </span>
    </Link>
  );
}

// Три підбірки в один ряд (на комп'ютері) або вкладками (на телефоні). Порожні підбірки не показуються.
export default function HomeCollections({ data, kinds }: { data: Record<Kind, ProductCardData[]>; kinds: Kind[] }) {
  const shown = kinds.filter((k) => data[k].length > 0);
  if (shown.length === 0) return null;
  return (
    <section className="hc" aria-label="Акції, хіти й новинки" style={{ ["--hc-n" as string]: shown.length }}>
      {shown.map((k, i) => (
        <input key={k} type="radio" name="hc-tab" id={`hc-r-${k}`} className={`hc-radio hc-radio-${i}`} defaultChecked={i === 0} aria-label={COLLECTION_TITLES[k]} />
      ))}
      <div className="hc-tabs" role="presentation">
        {shown.map((k, i) => (
          <label key={k} htmlFor={`hc-r-${k}`} className={`hc-tab hc-tab-${i}`}>{k === "hits" ? "Хіти" : COLLECTION_TITLES[k]}</label>
        ))}
      </div>
      <div className="hc-cols">
        {shown.map((k, i) => (
          <div key={k} className={`hc-col hc-col-${i}`}>
            <div className="hc-col-head">
              <h2 className="heading">{COLLECTION_TITLES[k]}</h2>
            </div>
            {data[k].slice(0, PER_COLUMN).map((p) => <Row key={p.id} p={p} kind={k} />)}
            <Link href={`/collection/${k}`} className="hc-more">{COLLECTION_ALL_LABELS[k]} →</Link>
          </div>
        ))}
      </div>
    </section>
  );
}
