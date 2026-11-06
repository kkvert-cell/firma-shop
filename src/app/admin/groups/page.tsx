import { requireAdmin } from "@/lib/admin-auth";
import { getRunner } from "@/lib/catalog";
import { groupsStatus } from "@/lib/prom-groups";

export const dynamic = "force-dynamic";

const OK = (sp: Record<string, string | undefined>): string | null => {
  switch (sp.ok) {
    case "synced": return `Готово: групи оновлено (${sp.n ?? 0} груп, до груп прив'язано змінених товарів: ${sp.a ?? 0}).`;
    case "translated": return `Переклади збережено: ${sp.n ?? 0}.${sp.u ? ` Невідомих номерів груп: ${sp.u}.` : ""}`;
    case "switched": return `Каталог тепер працює на ваших групах Prom. Перенесено товарів: ${sp.n ?? 0}, переспрямувань зі старих адрес: ${sp.r ?? 0}.`;
    case "rolledback": return `Старий каталог повернено (повернуто товарів: ${sp.n ?? 0}).`;
    default: return null;
  }
};

export default async function AdminGroups({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const run = getRunner();
  const st = await groupsStatus(run);
  const rows = await run(
    `SELECT "promId", name, "nameSource", "nameAuto", "isActive", "lockedFields", path
       FROM "Category" WHERE source = 'group' AND "inFeed" ORDER BY path`
  );
  const list = rows
    .map((r) => {
      const depth = String(r.path).split(" > ").length - 1;
      const note = [r.nameSource && r.nameSource !== r.name ? `було в Prom: ${r.nameSource}` : "", r.nameAuto ? "авто-переклад, перевірте" : "", !r.isActive ? "прихована" : ""].filter(Boolean).join("; ");
      return `${"  ".repeat(depth)}${r.promId} | ${r.name}${note ? ` // ${note}` : ""}`;
    })
    .join("\n");
  const msg = OK(sp);
  const groupsMode = st.mode === "groups";
  const last = st.last ? new Date(st.last).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }) : "ще не оновлювались";

  return (
    <main className="adm-main">
      <h1 className="heading page-title">Групи Prom</h1>
      {msg && <p className="notice">{msg}</p>}
      {sp.err && <p className="notice error">{sp.err}</p>}

      <p className="muted">
        Каталог зараз: <strong>{groupsMode ? "ваші групи й підгрупи з Prom" : "старі категорії маркетплейсу (ваші групи ще підготовлені, але не показуються)"}</strong>.
        Групи й прив&apos;язка товарів автоматично оновлюються з YML раз на годину; нижче можна оновити їх одразу.
      </p>
      <div className="adm-cards">
        <div className="adm-card"><span className="adm-card-label">Груп і підгруп</span><span className="adm-card-value">{st.counts.groups}</span></div>
        <div className="adm-card"><span className="adm-card-label">Товарів у групах</span><span className="adm-card-value">{st.counts.assigned} / {st.counts.total}</span></div>
        <div className="adm-card"><span className="adm-card-label">Переклад перевірити</span><span className={`adm-card-value${st.counts.review ? " warn" : ""}`}>{st.counts.review}</span></div>
      </div>
      <p className="muted small">Останнє оновлення груп: {last}.</p>

      <section className="card adm-block">
        <h2 className="heading section-title">Оновити групи з Prom зараз</h2>
        <form action="/api/admin/groups" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="sync" />
          <button type="submit" className="btn-primary">Оновити групи з Prom</button>
        </form>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">Назви груп українською</h2>
        <p className="muted small">
          Формат рядка: <code>номер групи | назва на сайті</code>. Усе після <code>//</code> — підказка, її можна лишити. Відредагуйте назви й натисніть «Зберегти»:
          вони збережуться назавжди і не змінюватимуться під час синхронізації. Цей список можна також скопіювати й надіслати мені для точного перекладу.
        </p>
        <form action="/api/admin/groups" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value="translations" />
          <label>Список груп<textarea name="text" rows={Math.min(24, Math.max(8, rows.length + 2))} defaultValue={list} spellCheck={false} style={{ fontFamily: "var(--font-data, monospace)", fontSize: 13 }} /></label>
          <button type="submit" className="btn-primary">Зберегти назви</button>
        </form>
      </section>

      <section className="card adm-block">
        <h2 className="heading section-title">{groupsMode ? "Повернути старий каталог" : "Перейти на мої групи"}</h2>
        <p className="muted small">
          {groupsMode
            ? "Показ повернеться до категорій маркетплейсу, товари повернуться в старі категорії (крім тих, що ви переносили вручну)."
            : "Покупці побачать ваші групи й підгрупи замість категорій маркетплейсу. Старі адреси категорій переспрямуються на найближчу нову групу. Група «Пристрої для дорослих» і її товари будуть приховані. Перемикання можна скасувати кнопкою нижче в цьому ж розділі."}
        </p>
        <form action="/api/admin/groups" method="post" className="checkout-form adm-form">
          <input type="hidden" name="op" value={groupsMode ? "rollback" : "switch"} />
          <label className="check"><input type="checkbox" name="confirm" value="yes" /> Так, я розумію, що зміниться каталог на сайті</label>
          <button type="submit" className={groupsMode ? "btn-secondary" : "btn-primary"}>{groupsMode ? "Повернути старий каталог" : "Перейти на мої групи"}</button>
        </form>
      </section>
    </main>
  );
}
