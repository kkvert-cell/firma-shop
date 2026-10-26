"use client";

import { useEffect, useRef, useState } from "react";

export type NpValue = { city: string; cityRef: string; point: string; pointRef: string };
type City = { ref: string; name: string };
type Warehouse = { ref: string; label: string; kind: "branch" | "postomat" | "other" };

type Props = {
  value: NpValue;
  onChange: (patch: Partial<NpValue>) => void;
  errors: Record<string, string>;
};

// Вибір міста й відділення Нової пошти зі списку. Якщо довідник недоступний або людині
// потрібна інша адреса — можна ввести вручну.
export default function NovaPoshtaPicker({ value, onChange, errors }: Props) {
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cityText, setCityText] = useState(value.city);
  const [cities, setCities] = useState<City[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [whText, setWhText] = useState("");
  const [whs, setWhs] = useState<Warehouse[]>([]);
  const [whLoading, setWhLoading] = useState(false);
  const cityReq = useRef(0);
  const whReq = useRef(0);

  function fail(status: number) {
    setManual(true);
    setNote(status === 503 ? null : "Довідник Нової пошти тимчасово недоступний — вкажіть відділення вручну.");
  }

  // підказки міст
  useEffect(() => {
    if (manual || value.cityRef || cityText.trim().length < 2) {
      setCities([]);
      return;
    }
    const id = ++cityReq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/np/cities?q=${encodeURIComponent(cityText.trim())}`);
        if (!res.ok) return fail(res.status);
        const data = await res.json();
        if (id === cityReq.current) setCities(data.items ?? []);
      } catch {
        fail(0);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [cityText, value.cityRef, manual]);

  // список відділень міста
  useEffect(() => {
    if (manual || !value.cityRef || value.pointRef) {
      setWhs([]);
      return;
    }
    const id = ++whReq.current;
    setWhLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/np/warehouses?city=${encodeURIComponent(value.cityRef)}&q=${encodeURIComponent(whText.trim())}`);
        if (!res.ok) return fail(res.status);
        const data = await res.json();
        if (id === whReq.current) setWhs(data.items ?? []);
      } catch {
        fail(0);
      } finally {
        if (id === whReq.current) setWhLoading(false);
      }
    }, whText ? 300 : 0);
    return () => clearTimeout(t);
  }, [value.cityRef, value.pointRef, whText, manual]);

  const err = (k: string) => (errors[k] ? <span className="field-error">{errors[k]}</span> : null);

  if (manual) {
    return (
      <>
        {note && <p className="notice">{note}</p>}
        <label>Населений пункт
          <input value={value.city} onChange={(e) => onChange({ city: e.target.value, cityRef: "", pointRef: "" })} autoComplete="address-level2" required />
          {err("city")}
        </label>
        <label>Відділення, поштомат або адреса
          <input value={value.point} onChange={(e) => onChange({ point: e.target.value, pointRef: "" })} placeholder="Наприклад: відділення №5" required />
          {err("point")}
        </label>
        <p className="small"><button type="button" className="link-btn" onClick={() => { setManual(false); setNote(null); setCityText(""); onChange({ city: "", cityRef: "", point: "", pointRef: "" }); }}>← Обрати зі списку Нової пошти</button></p>
      </>
    );
  }

  return (
    <>
      <label>Населений пункт
        <input
          value={cityText}
          onChange={(e) => {
            setCityText(e.target.value);
            setCityOpen(true);
            setWhText("");
            onChange({ city: e.target.value, cityRef: "", point: "", pointRef: "" });
          }}
          onFocus={() => setCityOpen(true)}
          placeholder="Почніть вводити назву"
          autoComplete="off"
          required
        />
        {err("city")}
      </label>
      {cityOpen && !value.cityRef && cities.length > 0 && (
        <ul className="np-list" role="listbox">
          {cities.map((c) => (
            <li key={c.ref}>
              <button
                type="button"
                onClick={() => {
                  setCityText(c.name);
                  setCityOpen(false);
                  setWhText("");
                  onChange({ city: c.name, cityRef: c.ref, point: "", pointRef: "" });
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.cityRef && (
        <>
          <label>Відділення або поштомат
            {value.pointRef ? (
              <span className="np-chosen">
                {value.point}
                <button type="button" className="link-btn" onClick={() => { setWhText(""); onChange({ point: "", pointRef: "" }); }}>змінити</button>
              </span>
            ) : (
              <input value={whText} onChange={(e) => setWhText(e.target.value)} placeholder="Номер або вулиця, наприклад: 5 або Мукачівська" autoComplete="off" />
            )}
            {err("point")}
          </label>
          {!value.pointRef && (
            <ul className="np-list" role="listbox">
              {whLoading && whs.length === 0 && <li className="np-hint">Завантажуємо…</li>}
              {!whLoading && whs.length === 0 && <li className="np-hint">Нічого не знайдено</li>}
              {whs.map((w) => (
                <li key={w.ref}>
                  <button type="button" onClick={() => onChange({ point: w.label, pointRef: w.ref })}>
                    {w.kind === "postomat" ? "🔲 " : ""}{w.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="small"><button type="button" className="link-btn" onClick={() => { setManual(true); setNote(null); onChange({ city: cityText, cityRef: "", pointRef: "" }); }}>Потрібна інша адреса? Вказати вручну</button></p>
    </>
  );
}
