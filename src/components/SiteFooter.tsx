import Link from "next/link";
import { legalPages } from "@/lib/legal-pages";
import { SELLER, sellerReady } from "@/lib/legal";
import { SHOP_PHONE, SHOP_PHONE_TEXT, SITE_NAME } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Умови">
        {legalPages().map((p) => (
          <Link key={p.slug} href={`/info/${p.slug}`}>{p.title.replace(" (договір купівлі-продажу)", "")}</Link>
        ))}
      </nav>
      <p className="muted small">
        {SITE_NAME} · <a href={`tel:${SHOP_PHONE}`}>{SHOP_PHONE_TEXT}</a>
        {sellerReady() ? ` · ${SELLER.name}, код ${SELLER.taxId}, ${SELLER.address}` : ""}
      </p>
    </footer>
  );
}
