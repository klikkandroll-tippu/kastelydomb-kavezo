import { NextRequest } from "next/server";
import { guard, db, json, body } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Confirmation is an admin-only database action. It does not send a Zapier email.
// Outgoing confirmation emails, if introduced later, need their own approved workflow.
const tables = {
  contacts: "kastelydomb_contacts",
  reservations: "kastelydomb_reservations",
  menu: "kastelydomb_orders",
  special: "kastelydomb_christmas_orders",
} as const;
export async function POST(req: NextRequest) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const data = await body(req, 1000);
    const kind = data.kind;
    const id = data.id;
    if (typeof kind !== "string" || !(kind in tables) ||
        typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(id))
      return json({ error: "Érvénytelen visszaigazolási kérelem." }, 400);
    const table = tables[kind as keyof typeof tables];
    const timestamp = new Date().toISOString();
    // One-way confirmation. A second click cannot replace the original timestamp.
    const qs = table + "?id=eq." + encodeURIComponent(id) +
      "&confirmed_at=is.null&select=id,status,confirmed_at";
    const response = await db(qs, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "confirmed", confirmed_at: timestamp }),
    });
    if (!response.ok) return json({ error: "A visszaigazolás mentése nem sikerült." }, 503);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ error: "A kérelem már visszaigazolt, vagy nem található. Frissítse a listát." }, 409);
    }
    return json({ ok: true, status: "confirmed", confirmed_at: (rows[0] as {confirmed_at:string}).confirmed_at });
  } catch {
    return json({ error: "A visszaigazolás jelenleg nem végezhető el." }, 503);
  }
}
