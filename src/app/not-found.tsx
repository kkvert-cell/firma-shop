import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Сторінку не знайдено", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main>
      <h1 className="heading page-title">Сторінку не знайдено</h1>
      <p className="muted">Можливо, товар уже продано або адресу введено з помилкою.</p>
      <p>
        <Link href="/catalog" className="btn-primary">До каталогу</Link>{" "}
        <Link href="/" className="btn-secondary">На головну</Link>
      </p>
    </main>
  );
}
