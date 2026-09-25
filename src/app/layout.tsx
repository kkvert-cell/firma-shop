import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firma — інструмент, електроніка, товари для дому",
  description: "Інтернет-магазин інструменту, вимірювальної техніки та гаджетів. Доставка по Україні.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
