import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { currentMenuDays } from "@/lib/menu-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const menuTemplate = join(process.cwd(), "public", "kastelydomb-napi-menu-v7.html");
const slot = '<div id="weekRows" class="day-list">';
const dateLabel = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "UTC",
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export async function GET() {
  const template = await readFile(menuTemplate, "utf8");
  const days = currentMenuDays();
  const content = days.length ? days.map(({ date, soup, A, B, C }) => `
    <section class="menu-preview-day">
      <h4><time datetime="${date}">${dateLabel.format(new Date(`${date}T12:00:00Z`))}</time></h4>
      <dl>
        <dt>Leves</dt><dd>${escapeHtml(soup)}</dd>
        <dt>A menü</dt><dd>${escapeHtml(A)}</dd>
        <dt>B menü</dt><dd>${escapeHtml(B)}</dd>
        <dt>C menü</dt><dd>${escapeHtml(C)}</dd>
      </dl>
    </section>`).join("") : '<p class="fineprint">Jelenleg nincs közzétett heti menü.</p>';

  return new Response(template.replace(slot, () => slot + content), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
