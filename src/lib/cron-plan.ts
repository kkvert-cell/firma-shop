// План фоновых задач (единое место для worker.ts, scheduled.ts и тестов).
// Два триггера, оба срабатывают в одно «окно» каждые 30 минут, чтобы база успевала засыпать между окнами:
//   :00 и :30 — остатки KeyCRM, добор заказов, акции
//   :01 и :31 — каталог Prom (порциями) и YML
// Строки должны совпадать с wrangler.json → triggers.crons (это проверяет автотест).

import { kyivParts, lastKyivSlotStart } from "./kyiv-time";

export const CRON_STOCK = "0,30 * * * *";
export const CRON_PROM = "1,31 * * * *";

// Каталог Prom обновляется дважды в сутки: цикл стартует в окне после 06:00 и 18:00 по Киеву
export const PROM_SLOT_HOURS = [6, 18];
const PROM_WINDOW_HOURS = [6, 7, 8, 9, 18, 19, 20, 21];

// YML (артикулы и группы) — раз в 6 часов
export const YML_EVERY_MS = 5.5 * 3600_000; // небольшой запас, чтобы запуск не «проскакивал» из-за сдвига на минуты

export const promWindowOpen = (now: Date) => PROM_WINDOW_HOURS.includes(kyivParts(now).hour);

// Начинать ли новый цикл обновления каталога. lastDone === null — никогда не обновляли или вручную попросили обновить сейчас.
export function shouldStartPromCycle(lastDone: Date | null, now: Date): boolean {
  if (!lastDone) return true;
  return promWindowOpen(now) && lastDone.getTime() < lastKyivSlotStart(now, PROM_SLOT_HOURS).getTime();
}

export const ymlDue = (lastRun: Date | null, now: Date) => !lastRun || now.getTime() - lastRun.getTime() > YML_EVERY_MS;
