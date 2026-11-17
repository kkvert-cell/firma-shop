import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/catalog";
import { customerFromRequest, sameOriginPost } from "@/lib/customer-auth";
import { addAddress, deleteAddress, listAddresses, setDefaultAddress } from "@/lib/customer-data";

export const dynamic = "force-dynamic";

// Керування збереженими адресами: JSON { action: "add" | "delete" | "default", ... }. Відповідь — оновлений список.
export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) return new NextResponse("Forbidden", { status: 403 });
  const email = customerFromRequest(req);
  if (!email) return NextResponse.json({ error: "Увійдіть у кабінет" }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }
  try {
    const run = getRunner();
    if (b.action === "add") {
      const err = await addAddress(run, email, { carrier: b.carrier, city: b.city, cityRef: b.cityRef, warehouse: b.point, warehouseRef: b.pointRef });
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    } else if (b.action === "delete") await deleteAddress(run, email, b.id);
    else if (b.action === "default") await setDefaultAddress(run, email, b.id);
    else return NextResponse.json({ error: "Невідома дія" }, { status: 400 });
    return NextResponse.json({ addresses: await listAddresses(run, email) });
  } catch (e) {
    console.error("account addresses:", e);
    return NextResponse.json({ error: "Не вдалося зберегти. Спробуйте ще раз." }, { status: 500 });
  }
}
