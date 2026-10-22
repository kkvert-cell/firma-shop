"use client";

import { useEffect, useRef, useState } from "react";

// Картинка с запасным вариантом: если уменьшенная копия не загрузилась — показываем оригинал.
// (Проверка в useEffect нужна, потому что ошибка могла случиться ещё до "оживления" страницы.)
export default function SmartImage({
  src,
  fallback,
  alt,
  loading = "lazy",
  className,
}: {
  src: string;
  fallback: string;
  alt: string;
  loading?: "lazy" | "eager";
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={failed ? fallback : src} alt={alt} loading={loading} decoding="async" className={className} onError={() => setFailed(true)} />
  );
}
