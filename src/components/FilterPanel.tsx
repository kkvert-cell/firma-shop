"use client";

import { useState } from "react";

// На телефоне фильтры прячутся за кнопкой, на компьютере всегда на виду (это решает CSS).
export default function FilterPanel({ children, activeCount }: { children: React.ReactNode; activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filters-panel">
      <button type="button" className="filter-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Фільтри{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div className={`filters-body${open ? " open" : ""}`}>{children}</div>
    </div>
  );
}
