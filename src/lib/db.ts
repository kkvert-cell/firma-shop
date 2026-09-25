import { neon } from "@neondatabase/serverless";

// Лёгкий HTTP-драйвер Neon вместо Prisma Client: обычные SQL-запросы,
// без нативного "движка" — то, что нужно для работы на Cloudflare
// Workers/Pages (там нельзя запускать нативные бинарники).
// Структура таблиц описана в prisma/schema.prisma и schema.sql — они
// остаются источником истины по структуре данных, просто запросы
// пишутся как обычный SQL, а не через ORM.
//
// getSql() создаёт подключение лениво (не в момент импорта файла), чтобы
// сборка проекта не падала целиком, если переменная DATABASE_URL временно
// не задана (например, при локальной сборке без .env).
export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL не задана — перевірте .env / налаштування хостингу");
  }
  return neon(process.env.DATABASE_URL);
}
