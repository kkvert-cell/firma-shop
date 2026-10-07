import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Страницы с живыми данными из базы (главная, каталог, товар, API) не должны
  // кэшироваться на серверах Cloudflare — иначе посетители (и мы при проверках)
  // будут годами видеть "замороженный" снимок сайта вместо актуальных данных.
  // Файлы _next/static/* сюда не попадают — у них в имени "отпечаток" содержимого,
  // так что их кэшировать можно и нужно, это ускоряет сайт.
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
