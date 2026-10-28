import { NextRequest } from "next/server";
import { guard, db, json } from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const payments = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      const r = await db(
        `kastelydomb_payments?select=order_id,amount_huf&order=id&limit=1000&offset=${offset}`,
      );
      if (!r.ok) throw Error();
      const rows = await r.json();
      payments.push(...rows);
      if (rows.length < 1000) break;
      if (offset === 9000) throw Error();
    }
    const totals = new Map<string, number>();
    for (const p of payments)
      totals.set(p.order_id, (totals.get(p.order_id) || 0) + p.amount_huf);
    const orders = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      const r = await db(
        `kastelydomb_orders?select=id,order_number,customer_name,customer_email,customer_phone,customer_type,company_name,company_address,tax_number,fulfillment,delivery_address,payment_method,payment_status,status,total_huf,items,notes,created_at&order=created_at.desc,id&limit=1000&offset=${offset}`,
      );
      if (!r.ok) throw Error();
      const rows = await r.json();
      orders.push(...rows);
      if (rows.length < 1000)
        return json({
          orders: orders.map((o) => ({
            ...o,
            paid_huf: totals.get(o.id) || 0,
          })),
        });
    }
    return json(
      {
        error:
          "Túl sok rendelés. Az archívum lekérdezéséhez szűkebb időszak szükséges.",
      },
      422,
    );
  } catch {
    return json({ error: "A rendelések nem tölthetők be." }, 503);
  }
}
