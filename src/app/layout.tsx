import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Firma — інструмент, електроніка, товари для дому",
  description: "Інтернет-магазин інструменту, вимірювальної техніки та гаджетів. Доставка по Україні.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
