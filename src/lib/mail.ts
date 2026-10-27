// Лист покупцю з підтвердженням замовлення (сервіс Resend). Працює, лише якщо в Cloudflare додано секрети
// RESEND_API_KEY та MAIL_FROM (наприклад: Firma <orders@ваш-домен.ua>). Без них нічого не відправляється.
// Адреса відправника має бути з підтвердженого в Resend домену.

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const res = await fetch((process.env.RESEND_BASE_URL ?? "https://api.resend.com") + "/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.error("[mail] Resend відповів", res.status);
    return res.ok;
  } catch {
    console.error("[mail] Не вдалося надіслати лист");
    return false;
  }
}
