import Link from "next/link";
import { SHOP_PHONE, SHOP_PHONE_TEXT } from "@/lib/site";
import CartLink from "./CartLink";
import SearchBox from "./SearchBox";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="logo">Firma</Link>
        <SearchBox className="header-search" placeholder="Назва або артикул" />
        <a href={`tel:${SHOP_PHONE}`} className="header-link header-phone">{SHOP_PHONE_TEXT}</a>
        <Link href="/account" className="header-link">Кабінет</Link>
        <CartLink />
      </div>
    </header>
  );
}
