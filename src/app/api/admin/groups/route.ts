// Групи Prom: оновити з YML, переклади списком, перемкнути каталог на групи й повернути назад.
import { NextRequest, NextResponse } from "next/server";
import { apiAdminOk } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { invalidateCatalogTree } from "@/lib/catalog-tree";
import { applyTranslations, rollbackToLegacy, switchToGroups, syncYml } from "@/lib/prom-groups";

export const dynamic = "force-dynamic";

const go = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/admin/groups?${q}`, req.url), 303);
const err = (req: NextRequest, m: string) => go(req, `err=${encodeURIComponent(m)}`);

export async function POST(req: NextRequest) {
  if (!apiAdminOk(req)) return new NextResponse("Forbidden", { status: 403 });
  const f = await req.formData();
  const op = String(f.get("op") ?? "");
  const run = getRunner();
  try {
    if (op === "sync") {
      const url = process.env.PROM_YML_URL;
      if (!url) return err(req, "Не задано PROM_YML_URL (посилання на YML у секретах Cloudflare)");
      const r = await syncYml(run, url);
      invalidateCatalogTree();
      if (r.groups.skipped) return err(req, r.groups.skipped);
      return go(req, `ok=synced&n=${r.groups.groups}&a=${r.groups.assigned}`);
    }
    if (op === "translations") {
      const r = await applyTranslations(run, String(f.get("text") ?? "").slice(0, 60000));
      invalidateCatalogTree();
      return go(req, `ok=translated&n=${r.updated}${r.unknown.length ? `&u=${r.unknown.length}` : ""}`);
    }
    if (op === "switch") {
      if (f.get("confirm") !== "yes") return err(req, "Поставте галочку, щоб підтвердити перемикання");
      const r = await switchToGroups(run);
      invalidateCatalogTree();
      return go(req, `ok=switched&n=${r.moved}&r=${r.redirects}`);
    }
    if (op === "rollback") {
      if (f.get("confirm") !== "yes") return err(req, "Поставте галочку, щоб підтвердити повернення");
      const r = await rollbackToLegacy(run);
      invalidateCatalogTree();
      return go(req, `ok=rolledback&n=${r.restored}`);
    }
  } catch (e) {
    console.error("admin groups:", e);
    return err(req, e instanceof Error ? e.message.slice(0, 240) : "Не вдалося виконати дію");
  }
  return new NextResponse("Bad request", { status: 400 });
}
