// Checkout без обязательной регистрации — только контакты и доставка.
// В реальном проекте это Server Action, создающий Order + OrderItem[] + Shipment.

export default function CheckoutPage() {
  return (
    <main style={{ maxWidth: 560 }}>
      <h1 className="heading" style={{ fontSize: "var(--text-2xl)" }}>Оформлення замовлення</h1>

      <div className="tick-divider" style={{ margin: "var(--space-4) 0" }} />

      <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <input name="firstName" placeholder="Ім'я" required style={{ flex: 1 }} />
          <input name="lastName" placeholder="Прізвище" required style={{ flex: 1 }} />
        </div>
        <input name="phone" type="tel" placeholder="Телефон" required />
        <input name="email" type="email" placeholder="Email (необов'язково)" />

        <div className="tick-divider" style={{ margin: "var(--space-2) 0" }} />

        <strong>Доставка</strong>
        <select name="carrier" required>
          <option value="">Оберіть перевізника</option>
          <option value="nova_poshta">Нова пошта</option>
          <option value="ukrposhta">Укрпошта</option>
        </select>
        <input name="city" placeholder="Місто" required />
        <input name="warehouse" placeholder="Відділення / адреса" required />

        <div className="tick-divider" style={{ margin: "var(--space-2) 0" }} />

        <strong>Оплата</strong>
        <label><input type="radio" name="payment" value="cod" defaultChecked /> Накладений платіж</label>
        <label><input type="radio" name="payment" value="online" /> Онлайн-оплата карткою</label>
        <label><input type="radio" name="payment" value="bank" /> Безнал (для юросіб)</label>

        <textarea name="comment" placeholder="Коментар до замовлення" rows={3} />

        <button type="submit" className="btn-primary" style={{ padding: "12px", marginTop: "var(--space-2)" }}>
          Підтвердити замовлення
        </button>
      </form>
    </main>
  );
}
