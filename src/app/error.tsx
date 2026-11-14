"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <h1 className="heading page-title">Щось пішло не так</h1>
      <p className="muted">Спробуйте оновити сторінку. Якщо помилка повторюється, зателефонуйте нам.</p>
      <p>
        <button type="button" className="btn-primary" onClick={() => reset()}>Спробувати ще раз</button>{" "}
        <Link href="/" className="btn-secondary">На головну</Link>
      </p>
    </main>
  );
}
