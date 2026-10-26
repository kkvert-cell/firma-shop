"use client";

import { useEffect, useRef } from "react";

// Форма переходу на сторінку оплати. Якщо auto — відправляється сама одразу після оформлення замовлення.
export default function PayForm({ action, fields, auto, label }: { action: string; fields: [string, string][]; auto: boolean; label: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (auto && !done.current) {
      done.current = true;
      ref.current?.submit();
    }
  }, [auto]);
  return (
    <form ref={ref} action={action} method="post" acceptCharset="utf-8">
      {fields.map(([k, v], i) => <input key={i} type="hidden" name={k} value={v} />)}
      {auto && <p className="muted">Переходимо до оплати…</p>}
      <button type="submit" className="btn-primary">{label}</button>
    </form>
  );
}
