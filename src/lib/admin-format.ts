export const STATUS_LABEL: Record<string, string> = {
  NEW: "Нове",
  CONFIRMED: "Підтверджено",
  PROCESSING: "В обробці",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
};
export const STATUSES = Object.keys(STATUS_LABEL);
export const PAY_LABEL: Record<string, string> = { CASH_ON_DELIVERY: "накладений платіж", BANK_TRANSFER: "за реквізитами", ONLINE_CARD: "картка онлайн" };
export const CARRIER_LABEL: Record<string, string> = { NOVA_POSHTA: "Нова пошта", UKRPOSHTA: "Укрпошта", SAT: "САТ", OTHER: "Інше" };

// Дата з бази (UTC, без часового поясу) → київський час
export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T").replace(/Z?$/, "Z"));
  if (isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

type Chip = { text: string; tone: "ok" | "warn" | "bad" | "mute" };

export function payChip(method: unknown, payStatus: unknown): Chip {
  if (String(method) === "ONLINE_CARD") {
    if (String(payStatus) === "PAID") return { text: "сплачено карткою", tone: "ok" };
    if (String(payStatus) === "REFUNDED") return { text: "повернено", tone: "mute" };
    return { text: "очікує оплати", tone: "warn" };
  }
  return { text: PAY_LABEL[String(method)] ?? String(method ?? "—"), tone: "mute" };
}

export function keycrmChip(o: { keycrmOrderId?: unknown; keycrmAttempts?: unknown; method?: unknown; payStatus?: unknown }): Chip {
  if (o.keycrmOrderId) return { text: `KeyCRM №${o.keycrmOrderId}`, tone: "ok" };
  if (String(o.method) === "ONLINE_CARD" && String(o.payStatus) !== "PAID") return { text: "піде в KeyCRM після оплати", tone: "mute" };
  const n = Number(o.keycrmAttempts ?? 0);
  if (n >= 99) return { text: "не передається (старе)", tone: "mute" };
  if (n >= 6) return { text: "НЕ в KeyCRM", tone: "bad" };
  return { text: "ще не в KeyCRM", tone: "warn" };
}
