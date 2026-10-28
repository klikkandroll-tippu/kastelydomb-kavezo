import { json } from "@/lib/admin-server";
import { acceptsOrders, isTestMode } from "@/lib/app-mode";
export const dynamic = "force-dynamic";
export function GET() {
  return json({ mode: isTestMode() ? "test" : "production", order_intake_enabled: acceptsOrders() });
}
