import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { accountEnabled, allowLoginRequest, makeLoginToken, normalizeEmail, sameOriginPost } from "@/lib/customer-auth";
import { sendMail } from "@/lib/mail";
import { SHOP_PHONE_TEXT, SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/account?${q}`, req.url), 303);

// Відповідь завжди однакова («якщо така адреса є — лист надіслано»), щоб не можна було перевіряти чужі адреси.
export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) return new NextResponse("Forbidden", { status: 403 });
  if (!accountEnabled()) return back(req, "e=off");
  const form = await req.formData();
  if (String(form.get("website") ?? "")) return back(req, "sent=1"); // «пастка» для ботів
  const email = normalizeEmail(form.get("email"));
  if (!email) return back(req, "e=email");
  try {
    const run = getRunner();
    if (await allowLoginRequest(run, email)) {
      const has = await run(`SELECT 1 AS x FROM "Order" WHERE lower(email) = $1 LIMIT 1`, [email]);
      if (has.length) {
        const link = `${SITE_URL}/account/verify?t=${encodeURIComponent(makeLoginToken(email))}`;
        await sendMail(
          email,
          `Вхід у кабінет — ${SITE_NAME}`,
          `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:520px">
<h2 style="margin:0 0 12px">Вхід у особистий кабінет</h2>
<p>Натисніть кнопку, щоб увійти. Посилання діє 15 хвилин.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#1f4d7a;color:#fff;text-decoration:none;border-radius:6px">Увійти в кабінет</a></p>
<p style="color:#666">Якщо ви не запитували вхід, просто проігноруйте цей лист. ${SITE_NAME}, ${SHOP_PHONE_TEXT}</p></div>`
        );
      }
    }
  } catch (e) {
    console.error("account login:", e);
  }
  return back(req, "sent=1");
}
