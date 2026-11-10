import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Адмінка", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  return (
    <div className="adm">
      {admin && (
        <nav className="adm-nav" aria-label="Адмінка">
          <Link href="/admin/dashboard">Огляд</Link>
          <Link href="/admin/orders">Замовлення</Link>
          <Link href="/admin/products">Товари</Link>
          <Link href="/admin/categories">Категорії</Link>
          <Link href="/admin/prices">Ціни</Link>
          <Link href="/admin/sales">Акції</Link>
          <Link href="/admin/groups">Групи Prom</Link>
          <Link href="/admin/tools">Інструменти</Link>
          <form action="/api/admin/logout" method="post"><button type="submit" className="link-btn">Вийти</button></form>
        </nav>
      )}
      {children}
    </div>
  );
}
