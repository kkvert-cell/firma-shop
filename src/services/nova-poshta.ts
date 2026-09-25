// ============================================================================
// Интеграция с Новой поштой. Код рабочий, но без реального ключа API ничего
// не отправит — ключ подставляется через переменную окружения NOVA_POSHTA_API_KEY,
// когда она появится (получается бесплатно в личном кабинете Новой пошти).
// ============================================================================

const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";
const API_KEY = process.env.NOVA_POSHTA_API_KEY;

type Warehouse = { ref: string; description: string; number: string };

// Получить список отделений в городе — используется в checkout, чтобы
// покупатель выбрал отделение из выпадающего списка, а не вписывал вручную.
export async function getWarehouses(cityRef: string): Promise<Warehouse[]> {
  if (!API_KEY) {
    console.warn("NOVA_POSHTA_API_KEY не задан — повертаю тестові дані");
    return [
      { ref: "test-1", description: "Відділення №1: вул. Приклад, 1", number: "1" },
      { ref: "test-2", description: "Відділення №2: вул. Приклад, 5", number: "2" },
    ];
  }

  const res = await fetch(NP_API_URL, {
    method: "POST",
    body: JSON.stringify({
      apiKey: API_KEY,
      modelName: "AddressGeneral",
      calledMethod: "getWarehouses",
      methodProperties: { CityRef: cityRef },
    }),
  });
  const data = await res.json();
  return data.data.map((w: any) => ({ ref: w.Ref, description: w.Description, number: w.Number }));
}

// Создать накладную (ТТН) после подтверждения заказа. В реальном проекте
// вызывается из order.service.ts сразу после создания Order со статусом CONFIRMED.
export async function createShipment(orderId: string, warehouseRef: string, weight: number) {
  if (!API_KEY) {
    console.warn("NOVA_POSHTA_API_KEY не задан — ТТН не створено (заготовка)");
    return { trackingId: "TEST-000000000" };
  }

  const res = await fetch(NP_API_URL, {
    method: "POST",
    body: JSON.stringify({
      apiKey: API_KEY,
      modelName: "InternetDocument",
      calledMethod: "save",
      methodProperties: {
        RecipientWarehouseRef: warehouseRef,
        Weight: weight,
        // остальные обязательные поля (отправитель, получатель) заполняются
        // из данных компании и заказа при реальном подключении
      },
    }),
  });
  const data = await res.json();
  return { trackingId: data.data[0]?.IntDocNumber };
}
