// Форма запроса счёта или коммерческого предложения. Вызывается либо с карточки
// товара (один товар), либо из корзины (весь список) — items передаётся снаружи.
// В реальном проекте отправка создаёт InvoiceRequest (см. schema.prisma) со
// снепшотом товаров и уведомляет менеджера.

export default function InvoiceRequestForm({
  mode = "cart",
}: {
  mode?: "cart" | "single-product";
}) {
  return (
    <div className="card" style={{ padding: "var(--space-6)", maxWidth: 480 }}>
      <h2 className="heading" style={{ fontSize: "var(--text-lg)" }}>
        {mode === "cart" ? "Запит рахунку на замовлення" : "Запросити рахунок на товар"}
      </h2>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
        Заповніть реквізити компанії — менеджер надішле рахунок або комерційну пропозицію на email.
      </p>

      <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        <input name="companyName" placeholder="Назва компанії" required />
        <input name="edrpou" placeholder="ЄДРПОУ" required />
        <input name="contactPerson" placeholder="Контактна особа" required />

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <input name="phone" type="tel" placeholder="Телефон" required style={{ flex: 1 }} />
          <input name="email" type="email" placeholder="Email" required style={{ flex: 1 }} />
        </div>

        <textarea name="comment" placeholder="Коментар (за потреби)" rows={3} />

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button type="submit" name="docType" value="invoice" className="btn-primary" style={{ flex: 1, padding: "10px" }}>
            Отримати рахунок
          </button>
          <button type="submit" name="docType" value="proposal" className="card" style={{ flex: 1, padding: "10px" }}>
            Отримати КП
          </button>
        </div>
      </form>
    </div>
  );
}
