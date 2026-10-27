import { redirect } from "next/navigation";

// Раніше тут був макет імпорту з Excel. Товари тепер оновлюються автоматично з Prom і KeyCRM.
export default function ImportMoved() {
  redirect("/admin/products");
}
