import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { CUSTOMER_COOKIE, customerFromRequest, sameOriginPost } from "@/lib/customer-auth";
import { deleteMyData, saveProfile } from "@/lib/customer-data";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/account/profile?${q}`, req.url), 303);

// Збереження профілю або видалення своїх даних (форми на сторінці /account/profile)
export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) return new NextResponse("Forbidden", { status: 403 });
  const email = customerFromRequest(req);
  if (!email) return NextResponse.redirect(new URL("/account", req.url), 303);
  const form = await req.formData();
  try {
    if (String(form.get("action")) === "delete") {
      await deleteMyData(getRunner(), email);
      const res = NextResponse.redirect(new URL("/account?deleted=1", req.url), 303);
      res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }
    const err = await saveProfile(getRunner(), email, { firstName: form.get("firstName"), lastName: form.get("lastName"), phone: form.get("phone") });
    return back(req, err ? `err=${encodeURIComponent(err)}` : "ok=1");
  } catch (e) {
    console.error("account profile:", e);
    return back(req, `err=${encodeURIComponent("Не вдалося зберегти. Спробуйте ще раз.")}`);
  }
}
