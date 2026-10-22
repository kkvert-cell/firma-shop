import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { formatPrice } from "@/lib/site";
import { thumb } from "@/lib/image";
import SmartImage from "./SmartImage";

export default function ProductCard({ p }: { p: ProductCardData }) {
  return (
    <Link href={`/product/${p.slug}`} className="card product-card">
      <div className="product-card-img">
        {p.image ? <SmartImage src={thumb(p.image, 320)} fallback={p.image} alt={p.name} /> : <span className="no-photo">Немає фото</span>}
      </div>
      <div className="product-card-title">{p.name}</div>
      {p.vendorCode && <div className="data product-card-sku">Арт. {p.vendorCode}</div>}
      <div className="price-row">
        {p.price > 0 ? (
          <>
            <span className="price data">{formatPrice(p.price)} ₴</span>
            {p.oldPrice && p.oldPrice > p.price && <span className="old-price data">{formatPrice(p.oldPrice)} ₴</span>}
          </>
        ) : (
          <span className="stock-out">Ціну уточнюйте</span>
        )}
      </div>
      <div className={p.isAvailable ? "stock-in" : "stock-out"}>{p.isAvailable ? "В наявності" : "Немає в наявності"}</div>
    </Link>
  );
}
