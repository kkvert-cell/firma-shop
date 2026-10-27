import { redirect } from "next/navigation";

// Раніше тут був макет. Історія замовлень тепер на сторінці /account.
export default function OldOrders() {
  redirect("/account");
}
