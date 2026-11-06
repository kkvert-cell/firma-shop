import Link from "next/link";
import { SHOP_PHONE, SHOP_PHONE_TEXT } from "@/lib/site";
import { getRunner } from "@/lib/catalog";
import { getCatalogTree } from "@/lib/catalog-tree";
import CartLink from "./CartLink";
import SearchBox from "./SearchBox";
import CatalogMenu, { type MenuGroup } from "./CatalogMenu";

async function loadMenu(): Promise<MenuGroup[]> {
  try {
    const tree = await getCatalogTree(getRunner());
    return tree.map((g) => ({
      id: g.id, name: g.name, slug: g.slug, n: g.n,
      children: g.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, n: c.n })),
    }));
  } catch (err) {
    console.error("Не вдалося завантажити меню каталогу:", err);
    return [];
  }
}

export default async function SiteHeader() {
  const groups = await loadMenu();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Firma Vymir — на головну">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-64.png" width={36} height={36} alt="" />
          <span className="brand-text"><small>FIRMA</small><b>VYMIR</b></span>
        </Link>
        <CatalogMenu groups={groups} />
        <SearchBox className="header-search" placeholder="Назва або артикул" />
        <a href={`tel:${SHOP_PHONE}`} className="header-link header-phone">{SHOP_PHONE_TEXT}</a>
        <Link href="/account" className="header-link">Кабінет</Link>
        <CartLink />
      </div>
    </header>
  );
}
