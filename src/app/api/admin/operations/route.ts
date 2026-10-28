import { NextRequest } from "next/server";
import { body, db, guard, json, rpc } from "@/lib/admin-server";
import { validDays } from "@/lib/menu";
export const dynamic = "force-dynamic";
const tables = {
  drivers: "kastelydomb_drivers",
  assignments: "kastelydomb_assignments",
  payments: "kastelydomb_payments",
  settlements: "kastelydomb_settlements",
  menus: "kastelydomb_menu_weeks",
};
export async function GET(req: NextRequest) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const entries = await Promise.all(
      Object.entries(tables).map(async ([key, table]) => {
        const rows = [];
        for (let offset = 0; offset < 10000; offset += 1000) {
          const r = await db(
            `${table}?select=*&order=id&limit=1000&offset=${offset}`,
          );
          if (!r.ok) throw Error();
          const page = await r.json();
          rows.push(...page);
          if (page.length < 1000) return [key, rows];
        }
        throw Error();
      }),
    );
    return json(Object.fromEntries(entries));
  } catch {
    return json(
      { error: "A működési adatok nem tölthetők be teljes körűen." },
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const p = await body(req);
    let result;
    switch (p.action) {
      case "driver":
        if (
          typeof p.name !== "string" ||
          !p.name.trim() ||
          p.name.length > 120 ||
          typeof p.phone !== "string" ||
          !/^\+?[0-9 ()-]{8,40}$/.test(p.phone) ||
          typeof p.area !== "string" ||
          p.area.length > 180 ||
          typeof p.active !== "boolean"
        )
          throw Error("Hibás futáradatok.");
        result = await rpc("kd_driver", {
          p_id: p.id || null,
          p_name: p.name.trim(),
          p_phone: p.phone,
          p_area: p.area,
          p_active: p.active,
        });
        break;
      case "assign":
        result = await rpc("kd_assign", {
          p_order: p.order_id,
          p_driver: p.driver_id,
        });
        break;
      case "payment":
        if (
          !Number.isSafeInteger(p.amount_huf) ||
          p.amount_huf <= 0 ||
          !["cash", "card", "transfer"].includes(p.method) ||
          typeof p.request_id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(p.request_id)
        )
          throw Error("Hibás befizetés.");
        result = await rpc("kd_payment", {
          p_order: p.order_id,
          p_driver: p.driver_id || null,
          p_amount: p.amount_huf,
          p_method: p.method,
          p_request: p.request_id,
        });
        break;
      case "settle":
        result = await rpc("kd_settle", {
          p_driver: p.driver_id,
          p_start: p.period_start,
          p_end: p.period_end,
        });
        break;
      case "menu":
        if (
          !validDays(p.week_start, p.days) ||
          typeof p.published !== "boolean"
        )
          throw Error(
            "Hétfői kezdőnap és öt teljes hétköznap szükséges. Ünnepnapi ár külön jóváhagyást igényel.",
          );
        result = await rpc("kd_menu", {
          p_start: p.week_start,
          p_days: p.days,
          p_published: p.published,
        });
        break;
      default:
        throw Error("Ismeretlen művelet.");
    }
    return json({ result });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "A művelet sikertelen." },
      400,
    );
  }
}
