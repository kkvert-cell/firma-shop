import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountEnabled, getCustomerEmail } from "@/lib/customer-auth";
import { getRunner } from "@/lib/catalog";
import { getProfile } from "@/lib/customer-data";
import AccountNav from "@/components/AccountNav";

export const metadata: Metadata = { title: "Профіль", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  if (!accountEnabled()) redirect("/account");
  const email = await getCustomerEmail();
  if (!email) redirect("/account");
  let p = { firstName: "", lastName: "", phone: "" };
  try {
    p = await getProfile(getRunner(), email);
  } catch (e) {
    console.error("profile:", e);
  }

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Мій кабінет</h1>
      <AccountNav active="profile" />
      {sp.ok && <p className="notice">Збережено.</p>}
      {sp.err && <p className="notice error">{sp.err.slice(0, 200)}</p>}
      <section className="card adm-block">
        <h2 className="heading section-title">Контактні дані</h2>
        <form action="/api/account/profile" method="post" className="checkout-form">
          <label>E-mail<input type="email" value={email} disabled /></label>
          <label>Ім&apos;я<input type="text" name="firstName" defaultValue={p.firstName} maxLength={60} autoComplete="given-name" /></label>
          <label>Прізвище<input type="text" name="lastName" defaultValue={p.lastName} maxLength={60} autoComplete="family-name" /></label>
          <label>Телефон<input type="tel" name="phone" defaultValue={p.phone} placeholder="0XX XXX XX XX" maxLength={30} autoComplete="tel" /></label>
          <button type="submit" className="btn-primary">Зберегти</button>
        </form>
      </section>
      <section className="card adm-block">
        <h2 className="heading section-title">Видалити мої дані</h2>
        <p className="muted small">Буде видалено профіль і збережені адреси, ви вийдете з кабінету. Історія замовлень залишається в магазині: вона потрібна для обліку й гарантії.</p>
        <details>
          <summary className="btn-secondary" style={{ display: "inline-block", cursor: "pointer" }}>Видалити мої дані…</summary>
          <form action="/api/account/profile" method="post" style={{ marginTop: 12 }}>
            <input type="hidden" name="action" value="delete" />
            <p>Точно видалити профіль і збережені адреси?</p>
            <button type="submit" className="btn-primary">Так, видалити</button>
          </form>
        </details>
      </section>
      <p className="muted small"><Link href="/account">← До замовлень</Link></p>
    </main>
  );
}
