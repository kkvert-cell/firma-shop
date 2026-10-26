// Повідомлення власниці в Telegram. Працює, лише якщо в Cloudflare додано два секрети:
// TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID. Якщо їх немає — тихо нічого не робить.
// Токен ніколи не потрапляє в журнали.

export async function notifyOwner(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3500), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    console.error("[notify] Не вдалося надіслати повідомлення в Telegram");
    return false;
  }
}
