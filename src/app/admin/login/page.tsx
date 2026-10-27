import { redirect } from "next/navigation";
import { adminEnabled, isAdmin } from "@/lib/admin-auth";

const MSG: Record<string, string> = {
  bad: "Невірний пароль.",
  locked: "Забагато невдалих спроб. Спробуйте через 15 хвилин.",
  off: "Адмінку не налаштовано: додайте секрет ADMIN_PASSWORD (не менше 8 символів) у Cloudflare.",
  err: "Тимчасова помилка. Спробуйте ще раз.",
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await isAdmin()) redirect("/admin/dashboard");
  const { e } = await searchParams;
  return (
    <main className="adm-login">
      <h1 className="heading page-title">Вхід в адмінку</h1>
      {!adminEnabled() && <p className="notice error">{MSG.off}</p>}
      {e && MSG[e] && adminEnabled() && <p className="notice error">{MSG[e]}</p>}
      <form action="/api/admin/login" method="post" className="checkout-form">
        <label>Пароль<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
        <button type="submit" className="btn-primary">Увійти</button>
      </form>
    </main>
  );
}
