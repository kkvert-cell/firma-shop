import type { Metadata } from "next";
import WishlistView from "@/components/WishlistView";
import AccountNav from "@/components/AccountNav";

export const metadata: Metadata = { title: "Обране", robots: { index: false, follow: false } };

export default function WishlistPage() {
  return (
    <main>
      <h1 className="heading page-title">Обране</h1>
      <AccountNav active="wishlist" />
      <WishlistView />
    </main>
  );
}
