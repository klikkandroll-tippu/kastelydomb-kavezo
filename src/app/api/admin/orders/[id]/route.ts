import { NextRequest } from "next/server";
import { guard, body, rpc, json } from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const { id } = await context.params;
    const p = await body(req);
    if (
      !/^[0-9a-f-]{36}$/i.test(id) ||
      Object.keys(p).length !== 1 ||
      ![
        "new",
        "confirmed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
      ].includes(p.status)
    )
      return json({ error: "Érvénytelen módosítás." }, 400);
    return json({
      order: await rpc("kd_order_status", { p_order: id, p_status: p.status }),
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Mentési hiba." },
      400,
    );
  }
}
