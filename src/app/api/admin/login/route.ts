import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { COOKIE, adminEnabled, checkPassword, clearLoginFails, loginLocked, makeSession, recordLoginFail, sameOrigin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, error: string) => NextResponse.redirect(new URL(`/admin/login?e=${error}`, req.url), 303);

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  if (!adminEnabled()) return back(req, "off");

  const run = getRunner();
  try {
    if (await loginLocked(run)) return back(req, "locked");
    const form = await req.formData();
    if (!checkPassword(String(form.get("password") ?? ""))) {
      await recordLoginFail(run);
      await new Promise((r) => setTimeout(r, 700)); // невелика пауза проти підбору
      return back(req, "bad");
    }
    await clearLoginFails(run);
  } catch (e) {
    console.error("admin login:", e);
    return back(req, "err");
  }
  const s = makeSession();
  const res = NextResponse.redirect(new URL("/admin/dashboard", req.url), 303);
  res.cookies.set(COOKIE, s.value, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "strict", path: "/", maxAge: s.maxAge });
  return res;
}
