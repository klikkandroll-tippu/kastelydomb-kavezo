import { NextRequest, NextResponse } from "next/server";
import { body, db, rpc, hash, sameOrigin } from "@/lib/admin-server";
import { beforeCutoff, budapestParts, MenuDay } from "@/lib/menu";
export const dynamic = "force-dynamic";
type MenuKey = "A" | "B" | "C";
const validFulfillments = ["pickup", "delivery", "dine_in"] as const;
const validPayments = [
  "cash_on_pickup",
  "card_on_pickup",
  "company_transfer",
] as const;
const text = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req))
      return NextResponse.json(
        { error: "Nem engedélyezett kérésforrás." },
        { status: 403 },
      );
    if (process.env.ORDER_INTAKE_ENABLED !== "true")
      return NextResponse.json(
        { error: "Az online rendelésfogadás jelenleg még nem aktív." },
        { status: 503 },
      );
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: "A rendelésfogadás még nincs beállítva." },
        { status: 503 },
      );
    const size = Number(req.headers.get("content-length") || 0);
    if (size > 16000)
      return NextResponse.json(
        { error: "Túl nagy rendelés." },
        { status: 413 },
      );
    const input = await body(req, 16000).catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input))
      return NextResponse.json({ error: "Hibás kérés." }, { status: 400 });
    if (
      typeof input.request_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.request_id,
      )
    )
      return NextResponse.json(
        { error: "Hiányzó kérésazonosító." },
        { status: 400 },
      );
    const fingerprint = hash(JSON.stringify(input));
    const existing = await db(
      "kastelydomb_orders?id=eq." +
        input.request_id +
        "&select=order_number,total_huf,request_fingerprint",
    );
    if (!existing.ok)
      return NextResponse.json(
        { error: "A rendelés ellenőrzése sikertelen." },
        { status: 503 },
      );
    const previous = await existing.json();
    if (previous.length) {
      if (previous[0].request_fingerprint !== fingerprint)
        return NextResponse.json(
          { error: "Eltérő tartalmú ismételt kérés." },
          { status: 409 },
        );
      return NextResponse.json(
        {
          order_number: previous[0].order_number,
          total_huf: previous[0].total_huf,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }
    const customer_name = text(input.customer_name, 120),
      customer_phone = text(input.customer_phone, 40),
      customer_email = text(input.customer_email, 200);
    const company_address = text(input.company_address, 350),
      tax_number = text(input.tax_number, 20);
    const company_name = text(input.company_name, 180),
      delivery_address = text(input.delivery_address, 350),
      notes = text(input.notes, 1000);
    const customer_type =
        input.customer_type === "company" ? "company" : "private",
      fulfillment = input.fulfillment,
      payment_method = input.payment_method;
    if (
      !customer_name ||
      !/^\+?[0-9 ()-]{8,}$/.test(customer_phone) ||
      (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email))
    )
      return NextResponse.json(
        { error: "Hiányzó vagy hibás kapcsolattartási adatok." },
        { status: 400 },
      );
    if (
      !validFulfillments.includes(fulfillment) ||
      !validPayments.includes(payment_method)
    )
      return NextResponse.json(
        { error: "Nem elérhető átvétel vagy fizetés." },
        { status: 400 },
      );
    if (
      payment_method === "company_transfer" &&
      (customer_type !== "company" || !company_name || !customer_email)
    )
      return NextResponse.json(
        { error: "Átutalás csak teljes céges adatokkal lehetséges." },
        { status: 400 },
      );
    if (
      customer_type === "company" &&
      (!company_name ||
        !company_address ||
        !/^\d{8}-\d-\d{2}$/.test(tax_number))
    )
      return NextResponse.json(
        { error: "A céges számlázási adatok hiányosak." },
        { status: 400 },
      );
    if (fulfillment === "delivery" && !delivery_address)
      return NextResponse.json(
        { error: "A kiszállítási cím hiányzik." },
        { status: 400 },
      );
    if (input.plan !== "yes" && input.plan !== "no")
      return NextResponse.json(
        { error: "Érvénytelen rendeléstípus." },
        { status: 400 },
      );
    if (!Array.isArray(input.days) || input.days.length > 5)
      return NextResponse.json(
        { error: "Érvénytelen napok." },
        { status: 400 },
      );
    const menus = await db(
      "kastelydomb_menu_weeks?published=eq.true&select=days&order=week_start.desc&limit=8",
    );
    if (!menus.ok)
      return NextResponse.json(
        { error: "A menü nem érhető el." },
        { status: 503 },
      );
    const MENU: MenuDay[] = (await menus.json()).flatMap(
      (w: { days: MenuDay[] }) => w.days,
    );
    const allowed = await rpc("kd_rate_limit", {
      p_key: hash(
        "orders:" +
          (req.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
            "shared"),
      ),
      p_limit: 30,
      p_seconds: 900,
    });
    if (!allowed)
      return NextResponse.json(
        { error: "Túl sok rendelési kísérlet. Próbálja később." },
        { status: 429 },
      );
    let total = 0,
      days = 0;
    const items: Array<{
      date: string;
      menu: string;
      dish: string;
      quantity: number;
      soup?: string;
    }> = [];
    const seen = new Set<string>();
    for (const d of input.days) {
      if (typeof d !== "object" || !d || seen.has(d.date))
        return NextResponse.json(
          { error: "Duplikált vagy hibás nap." },
          { status: 400 },
        );
      seen.add(d.date);
      const menu = MENU.find((x) => x.date === d.date);
      if (!menu)
        return NextResponse.json(
          { error: "Az adott nap menüje nem rendelhető." },
          { status: 400 },
        );
      const qty = (k: string) => (d[k] === undefined ? 0 : d[k]);
      for (const k of ["A", "B", "C", "soup"]) {
        if (!Number.isInteger(qty(k)) || qty(k) < 0 || qty(k) > 5)
          return NextResponse.json(
            { error: "Érvénytelen adagszám." },
            { status: 400 },
          );
      }
      const a = qty("A"),
        b = qty("B"),
        c = qty("C"),
        s = qty("soup"),
        n = a + b + c;
      if (!n) {
        if (s)
          return NextResponse.json(
            { error: "Csak leves nem rendelhető." },
            { status: 400 },
          );
        continue;
      }
      if (!beforeCutoff(d.date, fulfillment))
        return NextResponse.json(
          { error: "A rendelési határidő lejárt." },
          { status: 400 },
        );
      if (input.plan === "yes" && (a || b)) {
        const date = new Date(d.date + "T00:00:00Z");
        date.setUTCDate(
          date.getUTCDate() + 3 - (((date.getUTCDay() + 6) % 7) + 1),
        );
        const cutoff = date.toISOString().slice(0, 10),
          t = budapestParts();
        if (t.date > cutoff || (t.date === cutoff && t.minutes >= 870))
          return NextResponse.json(
            { error: "Az A/B előfizetés határideje lejárt." },
            { status: 400 },
          );
      }
      if (menu.holiday)
        return NextResponse.json(
          { error: "Az ünnepnapi rendelés külön egyeztetést igényel." },
          { status: 400 },
        );
      if (s < c || s > n)
        return NextResponse.json(
          { error: "Levesmennyiség nem megfelelő." },
          { status: 400 },
        );
      if (input.plan === "no" && (a || b || s !== c))
        return NextResponse.json(
          { error: "Előfizetés nélkül csak C menü rendelhető levessel." },
          { status: 400 },
        );
      if ((a && !menu.A) || (b && !menu.B) || (c && !menu.C))
        return NextResponse.json(
          { error: "Nem rendelhető fogás." },
          { status: 400 },
        );
      total +=
        input.plan === "yes"
          ? (a + b) * 1700 + c * 2300 + (s - c) * 200
          : c * 2800;
      days++;
      for (const k of ["A", "B", "C"] as MenuKey[]) {
        const quantity = qty(k);
        if (quantity)
          items.push({ date: d.date, menu: k, dish: menu[k]!, quantity });
      }
      if (s)
        items.push({
          date: d.date,
          menu: "soup",
          dish: menu.soup,
          quantity: s,
        });
    }
    if (!days || (input.plan === "yes" && days < 2))
      return NextResponse.json(
        { error: "Válasszon megfelelő számú rendelési napot." },
        { status: 400 },
      );
    if (total > 250000)
      return NextResponse.json(
        { error: "Túl nagy rendelés." },
        { status: 400 },
      );
    const id = input.request_id,
      order_number =
        "MENU-" +
        new Date().toISOString().slice(2, 10).replace(/-/g, "") +
        "-" +
        id.slice(0, 8).toUpperCase();
    const data = {
      id,
      request_fingerprint: fingerprint,
      order_number,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      customer_type,
      company_name: company_name || null,
      company_address: company_address || null,
      tax_number: tax_number || null,
      fulfillment,
      delivery_address: delivery_address || null,
      payment_method,
      payment_status: "unpaid",
      status: "new",
      total_huf: total,
      items,
      notes: notes || null,
    };
    const response = await db("kastelydomb_orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const retry = await db(
        "kastelydomb_orders?id=eq." +
          id +
          "&select=order_number,total_huf,request_fingerprint",
      );
      if (retry.ok) {
        const rows = await retry.json();
        if (rows[0]?.request_fingerprint === fingerprint)
          return NextResponse.json(
            {
              order_number: rows[0].order_number,
              total_huf: rows[0].total_huf,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
      }
      return NextResponse.json(
        { error: "A rendelést nem sikerült tárolni. Kérjük, próbálja újra." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { order_number, total_huf: total },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "A rendelésfogadás átmenetileg nem elérhető." },
      { status: 503 },
    );
  }
}
