// ============================================================================
// 301-редиректы со старых ссылок Prom.ua на новые адреса.
//  • Товар: /p<id>-название[.html] (в т.ч. с префиксом /ua/ или /ru/) → /product/<наш адрес>.
//    Ищем по id товара на Проме (externalId), поэтому редирект работает без ручных таблиц.
//  • Категория: /g<id>-название[.html] → ищем в таблице Redirect (если заполнена), иначе ведём в общий каталог.
//  • Любую ссылку можно задать вручную в таблице Redirect (oldPath → newPath).
// Если база недоступна — просто не редиректим, а не роняем сайт.
// ============================================================================

import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const OLD_PROM = /^\/(?:(?:ua|ru)\/)?([pg])(\d{5,})(?:-[^/]*)?(?:\.html)?\/?$/;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const m = OLD_PROM.exec(path);
  if (!m) return NextResponse.next();
  const [, kind, id] = m;

  try {
    const sql = getSql();
    const bare = path.replace(/^\/(?:ua|ru)(?=\/)/, "");

    // 1) ручная таблица соответствий
    const manual = (await sql`
      SELECT "newPath" FROM "Redirect" WHERE "oldPath" = ANY(${[path, bare]}) AND "newPath" IS NOT NULL LIMIT 1
    `) as { newPath: string }[];
    if (manual[0]?.newPath) return NextResponse.redirect(new URL(manual[0].newPath, request.url), 301);

    // 2) товар: ищем по id с Прома
    if (kind === "p") {
      const rows = (await sql`SELECT slug FROM "Product" WHERE "externalId" = ${id} LIMIT 1`) as { slug: string }[];
      if (rows[0]) return NextResponse.redirect(new URL(`/product/${rows[0].slug}`, request.url), 301);
      return NextResponse.next(); // товара больше нет — обычная страница 404
    }

    // 3) категория без записи в таблице: ведём в каталог (временно, чтобы позже можно было уточнить)
    return NextResponse.redirect(new URL("/catalog", request.url), 302);
  } catch (err) {
    console.error("Помилка перевірки редіректу:", err);
    return NextResponse.next();
  }
}

export const config = {
  // Только пути в старом формате Prom: так остальные страницы не делают лишних запросов к БД
  matcher: ["/:old([pg]\\d{5,}.*)", "/ua/:old([pg]\\d{5,}.*)", "/ru/:old([pg]\\d{5,}.*)"],
};
