import type { Metadata } from "next";
import "@fontsource-variable/manrope/index.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

// Меню каталогу в шапці читається з бази, тому сторінки рендеряться під час запиту, а не під час збірки
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Firma Vymir — вимірювальний та ручний інструмент",
  description: "Інтернет-магазин інструменту, вимірювальної техніки та гаджетів. Доставка по Україні.",
  icons: {
    icon: [{ url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    siteName: "Firma Vymir",
    locale: "uk_UA",
    type: "website",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Firma Vymir — вимірювальний та ручний інструмент" }],
  },
  other: { "theme-color": "#133249" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
