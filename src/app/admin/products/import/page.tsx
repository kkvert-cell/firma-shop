"use client";

import { useState } from "react";

// Импорт по SKU: при повторной загрузке существующий товар (по sku) обновляется,
// а не дублируется (см. Product.sku @unique в schema.prisma). Перед реальным
// применением — обязательный preview, чтобы админ видел, что именно изменится.

type PreviewRow = {
  sku: string;
  name: string;
  type: "new" | "updated" | "error";
  note?: string;
};

const mockPreview: PreviewRow[] = [
  { sku: "SVR-150", name: "Штангенциркуль цифровий 150 мм", type: "updated", note: "ціна: 349 → 329 ₴" },
  { sku: "ANG-360", name: "Кутомір цифровий 360°", type: "new" },
  { sku: "", name: "Рядок без артикулу", type: "error", note: "відсутній SKU — рядок пропущено" },
];

export default function ImportPage() {
  const [step, setStep] = useState<"upload" | "preview">("upload");

  return (
    <main style={{ maxWidth: 720 }}>
      <h1 className="heading" style={{ fontSize: "var(--text-2xl)" }}>Імпорт товарів</h1>
      <p style={{ color: "var(--color-ink-muted)" }}>
        Завантажте файл XLSX або CSV, вивантажений з кабінету продавця Prom.ua.
      </p>

      <div className="tick-divider" style={{ margin: "var(--space-4) 0" }} />

      {step === "upload" && (
        <div className="card" style={{ padding: "var(--space-8)", textAlign: "center", borderStyle: "dashed" }}>
          <p>Перетягніть файл сюди або</p>
          <input type="file" accept=".xlsx,.csv" style={{ margin: "var(--space-3) 0" }} />
          <div>
            <button className="btn-primary" style={{ padding: "10px 20px" }} onClick={() => setStep("preview")}>
              Показати попередній перегляд
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
            <span style={{ color: "var(--color-success)" }}>● Нових: 1</span>
            <span style={{ color: "var(--color-accent)" }}>● Оновлено: 1</span>
            <span style={{ color: "var(--color-error)" }}>● Помилок: 1</span>
          </div>

          <table style={{ width: "100%", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "var(--border-hairline)" }}>
                <th style={{ padding: "6px 0" }}>SKU</th>
                <th>Назва</th>
                <th>Статус</th>
                <th>Деталі</th>
              </tr>
            </thead>
            <tbody>
              {mockPreview.map((row, i) => (
                <tr key={i} style={{ borderBottom: "var(--border-hairline)" }}>
                  <td className="data" style={{ padding: "6px 0" }}>{row.sku || "—"}</td>
                  <td>{row.name}</td>
                  <td
                    style={{
                      color:
                        row.type === "new"
                          ? "var(--color-success)"
                          : row.type === "error"
                          ? "var(--color-error)"
                          : "var(--color-accent)",
                    }}
                  >
                    {row.type === "new" ? "Новий" : row.type === "updated" ? "Оновлено" : "Помилка"}
                  </td>
                  <td style={{ color: "var(--color-ink-muted)" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-6)" }}>
            <button className="btn-primary" style={{ padding: "10px 20px" }}>
              Підтвердити імпорт
            </button>
            <button className="card" style={{ padding: "10px 20px" }} onClick={() => setStep("upload")}>
              Скасувати
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
