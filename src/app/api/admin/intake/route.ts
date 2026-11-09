import { NextRequest } from "next/server";
import { guard, db, json } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only integration endpoint. Any future mutations require separate permission checks.
// The shared admin password is temporary; role-specific accounts are a separate release gate.
const sources = {
  contacts: "kastelydomb_contacts?select=id,request_id,form_number,confirmed_at,customer_name,customer_email,customer_phone,message,status,internal_notes,is_test,created_at,updated_at",
  reservations: "kastelydomb_reservations?select=id,request_id,form_number,customer_name,customer_email,customer_phone,reservation_date,reservation_time,guest_count,guest_notes,status,confirmed_at,confirmed_by,internal_notes,is_test,created_at,updated_at",
  christmas: "kastelydomb_christmas_orders?select=id,order_number,confirmed_at,customer_name,customer_email,customer_phone,fulfillment,delivery_address,payment_method,items,total_huf,status,is_test,created_at",
} as const;

async function getRows(path: string) {
  const results: unknown[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const separator = path.includes("?") ? "&" : "?";
    const sort = path.startsWith("kastelydomb_special_payments") ? "paid_at" : "created_at";
    const response = await db(path + separator + "order=" + sort + ".desc&limit=500&offset=" + offset);
    if (!response.ok) throw Error("Database query failed");
    const batch: unknown = await response.json();
    if (!Array.isArray(batch)) throw Error("Invalid database response");
    results.push(...batch);
    if (batch.length < 500) return results;
  }
  throw Error("Archive limit exceeded; date-scoped pagination is required");
}

export async function GET(req: NextRequest) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const kind = req.nextUrl.searchParams.get("kind");
    if (kind && !(kind in sources)) return json({ error: "Ismeretlen adattípus." }, 400);
    const keys = kind ? [kind as keyof typeof sources] : Object.keys(sources) as Array<keyof typeof sources>;
    const out: Record<string, unknown[]> = {};
    const failed: string[] = [];
    for (const key of keys) {
      try { out[key] = await getRows(sources[key]); }
      catch { failed.push(key); }
    }
    // Payment receipts are read separately from order records to avoid conflating
    // payment status with manual confirmation. Omit on filtered, non-Christmas calls.
    if (!kind || kind === "christmas") {
      try {
        out.specialPayments = await getRows("kastelydomb_special_payments?select=order_id,amount_huf,method,paid_at,is_test");
      } catch { failed.push("specialPayments"); }
    }
    return json({ ...out, errors: failed, partial: failed.length > 0 }, failed.length >= keys.length + ((!kind || kind === "christmas") ? 1 : 0) ? 503 : 200);
  } catch {
    return json({ error: "Az admin nyilvántartás jelenleg nem tölthető be." }, 503);
  }
}
