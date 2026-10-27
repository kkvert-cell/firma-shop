import type { Metadata } from "next";
import Link from "next/link";
import { accountEnabled, verifyLoginToken } from "@/lib/customer-auth";

export const metadata: Metadata = { title: "Вхід у кабінет", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const mask = (e: string) => e.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");

// Вхід підтверджується кнопкою (POST), а не самим відкриттям посилання: так поштові сканери не «використають» його.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const email = accountEnabled() ? verifyLoginToken(t) : null;
  return (
    <main className="adm-login">
      <h1 className="heading page-title">Вхід у кабінет</h1>
      {email ? (
        <form action="/api/account/session" method="post" className="checkout-form">
          <p>Увійти як <b>{mask(email)}</b>?</p>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="btn-primary">Увійти</button>
        </form>
      ) : (
        <>
          <p className="notice error">Посилання недійсне або застаріло.</p>
          <p><Link href="/account">Запросити нове →</Link></p>
        </>
      )}
    </main>
  );
}
