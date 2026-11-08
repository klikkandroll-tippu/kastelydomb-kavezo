// Server-only opt-in database persistence. Disabled until E2E tests and
// retry/idempotency strategy are approved. Never import this into client components.
export function adminSyncEnabled() {
  return process.env.ADMIN_DB_SYNC_ENABLED === "true";
}
export async function persistAdminRow(table: "kastelydomb_contacts" | "kastelydomb_reservations" | "kastelydomb_orders" | "kastelydomb_christmas_orders", row: Record<string, unknown>) {
  if (!adminSyncEnabled()) return false;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("Admin adatmentési konfiguráció hiányzik.");
  const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/" + table, {
    method: "POST",
    headers: {
      apikey: key,
      ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw Error("Admin adatmentés sikertelen (" + response.status + ")");
  return true;
}
