import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountEnabled, getCustomerEmail } from "@/lib/customer-auth";
import { getRunner } from "@/lib/catalog";
import { listAddresses, type Address } from "@/lib/customer-data";
import AccountNav from "@/components/AccountNav";
import AddressManager from "@/components/AddressManager";

export const metadata: Metadata = { title: "Адреси доставки", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  if (!accountEnabled()) redirect("/account");
  const email = await getCustomerEmail();
  if (!email) redirect("/account");
  let list: Address[] = [];
  try {
    list = await listAddresses(getRunner(), email);
  } catch (e) {
    console.error("addresses:", e);
  }

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Мій кабінет</h1>
      <AccountNav active="addresses" />
      <AddressManager initial={list} />
      <p className="muted small"><Link href="/account">← До замовлень</Link></p>
    </main>
  );
}
