import Link from "next/link";
import { SHOP_PHONE, SHOP_PHONE_TEXT } from "@/lib/site";
import CartLink from "./CartLink";
import SearchBox from "./SearchBox";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Firma Vymir — на головну">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-64.png" width={36} height={36} alt="" />
          <span className="brand-text"><small>FIRMA</small><b>VYMIR</b></span>
        </Link>
        <SearchBox className="header-search" placeholder="Назва або артикул" />
        <a href={`tel:${SHOP_PHONE}`} className="header-link header-phone">{SHOP_PHONE_TEXT}</a>
        <Link href="/account" className="header-link">Кабінет</Link>
        <CartLink />
      </div>
    </header>
  );
}
