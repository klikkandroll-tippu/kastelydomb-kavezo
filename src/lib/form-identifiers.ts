import { adminSyncEnabled } from "@/lib/admin-persistence";

// A single service-role-only RPC allocates daily sequential identifiers.
// The UUID-to-code binding survives network retries with the same request_id.
export async function issueFormNumber(requestId: string, kind: "KF" | "NM" | "AF" | "KR"): Promise<string | null> {
  if (!adminSyncEnabled()) return null; // keep legacy Zapier behaviour unchanged outside integration
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("A sorszámozás adatbázis-kapcsolata hiányzik.");
  const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/kd_issue_form_number", {
    method: "POST",
    headers: {
      apikey: key,
      ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({p_request_id: requestId, p_prefix: kind}),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Nem sikerült az űrlapazonosító kiosztása.");
  const value: unknown = await response.json();
  if (typeof value !== "string" || !new RegExp("^" + kind + "-[0-9]{6}-[0-9]{4}$").test(value)) throw Error("Érvénytelen űrlapazonosító.");
  return value;
}
