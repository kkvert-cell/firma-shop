"use client";

import { useState } from "react";
import NovaPoshtaPicker, { type NpValue } from "./NovaPoshtaPicker";
import type { Address } from "@/lib/customer-data";

const CARRIER: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта" };
const EMPTY: NpValue = { city: "", cityRef: "", point: "", pointRef: "" };

// Збережені адреси доставки: додати, зробити основною, видалити
export default function AddressManager({ initial }: { initial: Address[] }) {
  const [list, setList] = useState<Address[]>(initial);
  const [adding, setAdding] = useState(initial.length === 0);
  const [carrier, setCarrier] = useState<"NOVA_POSHTA" | "UKRPOSHTA">("NOVA_POSHTA");
  const [val, setVal] = useState<NpValue>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/addresses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Не вдалося зберегти. Спробуйте ще раз.");
        return false;
      }
      setList(d.addresses ?? []);
      return true;
    } catch {
      setError("Немає зв'язку. Спробуйте ще раз.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (await send({ action: "add", carrier, ...val })) {
      setVal(EMPTY);
      setAdding(false);
    }
  }

  return (
    <div>
      {list.length === 0 && !adding && <p className="muted">Збережених адрес поки немає.</p>}
      {list.map((a) => (
        <section key={a.id} className="card adm-block">
          <p>
            <b>{CARRIER[a.carrier]}</b>: {a.city}, {a.warehouse} {a.isDefault && <span className="chip ok">основна</span>}
          </p>
          <div className="adm-inline">
            {!a.isDefault && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => send({ action: "default", id: a.id })}>
                Зробити основною
              </button>
            )}
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => send({ action: "delete", id: a.id })}>
              Видалити
            </button>
          </div>
        </section>
      ))}
      {error && <p className="notice error">{error}</p>}
      {adding ? (
        <form onSubmit={add} className="card adm-block checkout-form">
          <h2 className="heading section-title">Нова адреса</h2>
          <div className="adm-inline">
            <label className="check">
              <input type="radio" name="carrier" checked={carrier === "NOVA_POSHTA"} onChange={() => { setCarrier("NOVA_POSHTA"); setVal(EMPTY); }} /> Нова пошта
            </label>
            <label className="check">
              <input type="radio" name="carrier" checked={carrier === "UKRPOSHTA"} onChange={() => { setCarrier("UKRPOSHTA"); setVal(EMPTY); }} /> Укрпошта
            </label>
          </div>
          {carrier === "NOVA_POSHTA" ? (
            <NovaPoshtaPicker value={val} onChange={(patch) => setVal((v) => ({ ...v, ...patch }))} errors={{}} />
          ) : (
            <>
              <label>Місто<input type="text" value={val.city} maxLength={120} onChange={(e) => setVal((v) => ({ ...v, city: e.target.value }))} /></label>
              <label>Відділення (індекс)<input type="text" value={val.point} maxLength={200} onChange={(e) => setVal((v) => ({ ...v, point: e.target.value }))} /></label>
            </>
          )}
          <div className="adm-inline">
            <button type="submit" className="btn-primary" disabled={busy}>Зберегти адресу</button>
            {list.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => { setAdding(false); setError(null); }}>
                Скасувати
              </button>
            )}
          </div>
        </form>
      ) : (
        <p>
          <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>+ Додати адресу</button>
        </p>
      )}
    </div>
  );
}
