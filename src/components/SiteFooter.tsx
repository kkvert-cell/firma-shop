import Link from "next/link";
import { legalPages } from "@/lib/legal-pages";
import { SELLER, sellerReady } from "@/lib/legal";
import { SHOP_PHONE, SHOP_PHONE_TEXT, SITE_NAME } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-64.png" width={28} height={28} alt="" />
        <span className="brand-text"><small>FIRMA</small><b>VYMIR</b></span>
      </div>
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
