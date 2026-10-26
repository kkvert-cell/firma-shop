// Довідники Нової пошти (міста й відділення). Ключ живе лише на сервері (секрет NOVAPOSHTA_API_KEY).

const DEFAULT_URL = "https://api.novaposhta.ua/v2.0/json/";

export class NpUnavailable extends Error {}

type NpResponse = { success?: boolean; data?: unknown; errors?: unknown };

async function npCall(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>) {
  const apiKey = process.env.NOVAPOSHTA_API_KEY;
  if (!apiKey) throw new NpUnavailable("NOVAPOSHTA_API_KEY не задано");
  const res = await fetch(process.env.NOVAPOSHTA_BASE_URL ?? DEFAULT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Нова пошта відповіла ${res.status}`);
  const json = (await res.json()) as NpResponse;
  if (!json.success) throw new Error("Нова пошта повернула помилку");
  return json.data;
}

export type NpCity = { ref: string; name: string };
export type NpWarehouse = { ref: string; label: string; kind: "branch" | "postomat" | "other" };

type Rec = Record<string, unknown>;

export async function searchCities(query: string): Promise<NpCity[]> {
  const data = (await npCall("Address", "searchSettlements", { CityName: query, Limit: "10" })) as Rec[];
  const addresses = (data?.[0]?.Addresses ?? []) as Rec[];
  return addresses
    .filter((a) => a.DeliveryCity && Number(a.Warehouses ?? 1) > 0) // тільки де є відділення
    .map((a) => ({ ref: String(a.DeliveryCity), name: String(a.Present) }));
}

export async function searchWarehouses(cityRef: string, query: string): Promise<NpWarehouse[]> {
  const data = (await npCall("AddressGeneral", "getWarehouses", {
    CityRef: cityRef,
    FindByString: query,
    Limit: "40",
    Page: "1",
    Language: "UA",
  })) as Rec[];
  return (Array.isArray(data) ? data : []).map((w) => {
    const cat = String(w.CategoryOfWarehouse ?? "");
    return {
      ref: String(w.Ref),
      label: String(w.Description),
      kind: cat === "Postomat" ? "postomat" : cat === "Branch" ? "branch" : "other",
    };
  });
}
