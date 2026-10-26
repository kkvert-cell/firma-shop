"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/useCart";
import { formatPrice } from "@/lib/site";
import NovaPoshtaPicker from "@/components/NovaPoshtaPicker";

type Fields = Record<string, string>;
type Problem = { id: string; name: string; reason: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { mounted, loading, view, notices, total, blocked, clear } = useCart();
  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    carrier: "NOVA_POSHTA", city: "", cityRef: "", point: "", pointRef: "", payment: "CASH_ON_DELIVERY", comment: "", website: "",
  });
  const [errors, setErrors] = useState<Fields>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const token = useRef<string>("");

  useEffect(() => {
    // один и тот же код на время оформления: повторная отправка не создаст второй заказ
    let t = sessionStorage.getItem("firma-order-token");
    if (!t) {
      t = crypto.randomUUID();
      sessionStorage.setItem("firma-order-token", t);
    }
    token.current = t;
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    // как только человек начал исправлять поле — убираем красную подсказку под ним
    setErrors((prev) => {
      if (!prev[k]) return prev;
      const rest = { ...prev };
      delete rest[k];
      return rest;
    });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setServerError(null);
    setProblems([]);
    setErrors({});
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, token: token.current, items: view.map((l) => ({ id: l.id, qty: l.qty })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        sessionStorage.removeItem("firma-order-token");
        clear();
        router.push(`/order/${data.orderNumber}?t=${encodeURIComponent(data.token)}`);
        return;
      }
      if (data.fields) setErrors(data.fields);
      if (data.problems) setProblems(data.problems);
      setServerError(data.error ?? "Не вдалося оформити замовлення. Спробуйте ще раз.");
    } catch {
      setServerError("Немає зв'язку із сервером. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return <main><h1 className="heading page-title">Оформлення замовлення</h1></main>;
  if (view.length === 0) {
    return (
      <main>
        <h1 className="heading page-title">Оформлення замовлення</h1>
        <p className="empty-state">Кошик порожній. <Link href="/catalog">Перейти до каталогу</Link></p>
      </main>
    );
  }

  const err = (k: string) => (errors[k] ? <span className="field-error">{errors[k]}</span> : null);

  return (
    <main>
      <h1 className="heading page-title">Оформлення замовлення</h1>
      {notices.map((n, i) => <p key={i} className="notice">{n}</p>)}

      <div className="checkout-layout">
        <form onSubmit={submit} noValidate className="checkout-form">
          <fieldset>
            <legend>Контакти</legend>
            <div className="row2">
              <label>Ім&apos;я<input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" required />{err("firstName")}</label>
              <label>Прізвище<input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" required />{err("lastName")}</label>
            </div>
            <label>Телефон<input type="tel" value={form.phone} onChange={set("phone")} placeholder="0XX XXX XX XX" autoComplete="tel" required />{err("phone")}</label>
            <label>Email (необов&apos;язково)<input type="email" value={form.email} onChange={set("email")} autoComplete="email" />{err("email")}</label>
          </fieldset>

          <fieldset>
            <legend>Доставка</legend>
            <label className="check"><input type="radio" name="carrier" checked={form.carrier === "NOVA_POSHTA"} onChange={() => setForm((f) => ({ ...f, carrier: "NOVA_POSHTA", city: "", cityRef: "", point: "", pointRef: "" }))} /> Нова пошта (відділення, поштомат або адреса)</label>
            <label className="check"><input type="radio" name="carrier" checked={form.carrier === "UKRPOSHTA"} onChange={() => setForm((f) => ({ ...f, carrier: "UKRPOSHTA", city: "", cityRef: "", point: "", pointRef: "" }))} /> Укрпошта</label>
            {err("carrier")}
            {form.carrier === "NOVA_POSHTA" ? (
              <NovaPoshtaPicker
                value={{ city: form.city, cityRef: form.cityRef, point: form.point, pointRef: form.pointRef }}
                onChange={(patch) => {
                  setForm((f) => ({ ...f, ...patch }));
                  setErrors((prev) => {
                    const rest = { ...prev };
                    for (const k of Object.keys(patch)) delete rest[k === "cityRef" ? "city" : k === "pointRef" ? "point" : k];
                    return rest;
                  });
                }}
                errors={errors}
              />
            ) : (
              <>
                <label>Населений пункт<input value={form.city} onChange={set("city")} autoComplete="address-level2" required />{err("city")}</label>
                <label>Відділення або адреса<input value={form.point} onChange={set("point")} placeholder="Наприклад: відділення №5" required />{err("point")}</label>
              </>
            )}
            <p className="muted small">Вартість доставки сплачується за тарифами перевізника при отриманні.</p>
          </fieldset>

          <fieldset>
            <legend>Оплата</legend>
            <label className="check"><input type="radio" name="payment" checked={form.payment === "CASH_ON_DELIVERY"} onChange={() => setForm((f) => ({ ...f, payment: "CASH_ON_DELIVERY" }))} /> Накладений платіж (оплата при отриманні)</label>
            <label className="check"><input type="radio" name="payment" checked={form.payment === "BANK_TRANSFER"} onChange={() => setForm((f) => ({ ...f, payment: "BANK_TRANSFER" }))} /> Оплата за реквізитами (менеджер надішле їх вам)</label>
            {err("payment")}
          </fieldset>

          <label>Коментар до замовлення (необов&apos;язково)<textarea value={form.comment} onChange={set("comment")} rows={3} /></label>

          {/* приманка для роботів: людина це поле не бачить */}
          <div className="hp" aria-hidden="true">
            <label>Не заповнюйте<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
          </div>

          {serverError && (
            <div className="notice error" role="alert">
              {serverError}
              {problems.length > 0 && (
                <ul>{problems.map((p) => <li key={p.id}>«{p.name}»: {p.reason}</li>)}</ul>
              )}
              {problems.length > 0 && <Link href="/cart">Перейти до кошика</Link>}
            </div>
          )}

          <button type="submit" className="btn-primary wide" disabled={busy || blocked || loading}>
            {busy ? "Відправляємо…" : blocked ? "У кошику є недоступні товари" : "Підтвердити замовлення"}
          </button>
        </form>

        <aside className="card cart-summary">
          <h2 className="heading section-title">Ваше замовлення</h2>
          <ul className="summary-list">
            {view.map((l) => (
              <li key={l.id}>
                <span>{l.name} <span className="muted">× {l.qty}</span></span>
                <span className="data">{formatPrice(l.price * l.qty)} ₴</span>
              </li>
            ))}
          </ul>
          <div className="cart-sum-row">
            <span>Разом</span>
            <span className="price data">{formatPrice(total)} ₴</span>
          </div>
          <p><Link href="/cart">← Змінити кошик</Link></p>
        </aside>
      </div>
    </main>
  );
}
