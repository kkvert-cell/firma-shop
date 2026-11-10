"use client";

import { useEffect, useState } from "react";
import { copyrightYears } from "@/lib/copyright";

// Рік у копірайті сам змінюється: 2026 → 2026–2027 → 2026–2028 і так далі.
// Сервер дає рік на момент збірки сторінки, а браузер після завантаження ставить поточний.
export default function CopyrightYear({ serverYear, name }: { serverYear: number; name: string }) {
  const [year, setYear] = useState(serverYear);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>© {copyrightYears(year)} {name}</>;
}
