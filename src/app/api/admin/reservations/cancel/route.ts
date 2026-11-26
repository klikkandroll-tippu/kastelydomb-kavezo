import { NextRequest } from "next/server";
import { body, db, guard, json } from "@/lib/admin-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const denied = await guard(req);
    if (denied) return denied;

    const data = await body(req, 1000).catch(() => null);
    const id: unknown = data?.id;
    if (typeof id !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      return json({ error: "Érvénytelen foglalásazonosító." }, 400);
    }

    const row = "kastelydomb_reservations?id=eq." + encodeURIComponent(id) + "&select=status";
    const response = await db(row + "&status=in.(pending,confirmed)", {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return json({ error: "A törlés mentése nem sikerült." }, 503);
    const changed: Array<{ status: string }> = await response.json();
    if (changed[0]?.status === "cancelled") return json({ ok: true, status: "cancelled" });

    // A retry after a completed cancellation should succeed without changing the booking again.
    const lookup = await db(row);
    if (!lookup.ok) return json({ error: "A foglalás állapota nem ellenőrizhető." }, 503);
    const existing: Array<{ status: string }> = await lookup.json();
    if (["cancelled", "canceled"].includes(existing[0]?.status)) {
      return json({ ok: true, status: "cancelled" });
    }
    return json({ error: "A foglalás nem törölhető ebben az állapotban. Frissítse a listát." }, 409);
  } catch {
    return json({ error: "A törlés jelenleg nem végezhető el." }, 503);
  }
}
