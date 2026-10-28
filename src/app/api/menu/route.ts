import { db, json } from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw Error();
    const r = await db(
      "kastelydomb_menu_weeks?published=eq.true&select=week_start,days&order=week_start.desc&limit=8",
    );
    if (!r.ok) throw Error();
    return json({ weeks: await r.json() });
  } catch {
    return json({ error: "A heti kínálat nem tölthető be." }, 503);
  }
}
