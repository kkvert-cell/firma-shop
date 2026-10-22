import Link from "next/link";
import { SHOP_PHONE, SHOP_PHONE_TEXT } from "@/lib/site";
import CartLink from "./CartLink";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="logo">Firma</Link>
        <form action="/search" role="search" className="header-search">
          <input type="search" name="q" placeholder="Назва або артикул" aria-label="Пошук товарів" />
          <button type="submit" className="btn-primary">Знайти</button>
        </form>
        <a href={`tel:${SHOP_PHONE}`} className="header-link header-phone">{SHOP_PHONE_TEXT}</a>
        <CartLink />
      </div>
    </header>
  );
}
