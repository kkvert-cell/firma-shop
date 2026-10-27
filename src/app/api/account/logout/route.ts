import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_COOKIE } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/account", req.url), 303);
  res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
