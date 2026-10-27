import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_COOKIE, accountEnabled, makeSessionCookie, sameOriginPost, verifyLoginToken } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// Підтвердження входу (кнопка на сторінці /account/verify): лише POST, щоб поштові сканери посилань не «використовували» вхід.
export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) return new NextResponse("Forbidden", { status: 403 });
  const email = accountEnabled() ? verifyLoginToken(String((await req.formData()).get("t") ?? "")) : null;
  if (!email) return NextResponse.redirect(new URL("/account?e=link", req.url), 303);
  const s = makeSessionCookie(email);
  const res = NextResponse.redirect(new URL("/account", req.url), 303);
  res.cookies.set(CUSTOMER_COOKIE, s.value, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: s.maxAge });
  return res;
}
