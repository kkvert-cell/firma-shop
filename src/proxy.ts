// ============================================================================
// 301-редиректы со старых ссылок Prom.ua на новые URL нового сайта.
// Таблица заполняется из модели Redirect (schema.prisma) — когда появится
// реальный экспорт данных с firmashop.prom.ua, эта функция подтянет
// соответствия "старая ссылка -> новая" прямо из БД, чтобы не потерять
// уже проиндексированный Google-трафик.
// ============================================================================

import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const oldPath = request.nextUrl.pathname;

  try {
    const sql = getSql();
    // Пример: /g93431534-kontrolno-izmeritelnyj-instrument -> /catalog/izmeritelnyj-instrument
    const rows = (await sql`
      SELECT "newPath" FROM "Redirect" WHERE "oldPath" = ${oldPath} LIMIT 1
    `) as { newPath: string | null }[];

    if (rows[0]?.newPath) {
      return NextResponse.redirect(new URL(rows[0].newPath, request.url), 301);
    }
  } catch (err) {
    // Если база недоступна — просто не редиректим, а не роняем весь сайт
    console.error("Помилка перевірки редіректу:", err);
  }

  return NextResponse.next();
}

export const config = {
  // применяем только к путям в старом формате Prom.ua, чтобы не замедлять
  // остальные запросы лишним обращением к БД
  matcher: ["/g:id*", "/p:id*"],
};
