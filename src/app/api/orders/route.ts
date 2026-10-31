import { NextRequest, NextResponse } from "next/server";
import {acceptsOrders,isTestMode} from "@/lib/app-mode";
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
    if (!acceptsOrders())
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
        "&select=order_number,total_huf,request_fingerprint,is_test",
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
          is_test: previous[0].is_test,
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
        budapestParts().date.slice(2).replace(/-/g, "") +
        "-" +
        id.slice(0, 8).toUpperCase();
    const data = {
      is_test:isTestMode(),
      id,
      request_fingerprint: fingerprint,
      order_number,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      customer_type,
      company_name: customer_type === "company" ? company_name : null,
      company_address: customer_type === "company" ? company_address : null,
      tax_number: customer_type === "company" ? tax_number : null,
      fulfillment,
      delivery_address: fulfillment === "delivery" ? delivery_address : null,
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
          "&select=order_number,total_huf,request_fingerprint,is_test",
      );
      if (retry.ok) {
        const rows = await retry.json();
        if (rows[0]?.request_fingerprint === fingerprint)
          return NextResponse.json(
            {
              order_number: rows[0].order_number,
              total_huf: rows[0].total_huf,
                is_test:rows[0].is_test,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
      }
      return NextResponse.json(
        { error: "A rendelést nem sikerült tárolni. Kérjük, próbálja újra." },
        { status: 502 },
      );
    }
    // Preview-only Zapier integration. Never send a test order to a real guest.
    // The database write above is authoritative; no webhook on retries.
    if (isTestMode() && process.env.MENU_ZAPIER_ENABLED === "true") {
      const hook = process.env.MENU_ZAPIER_WEBHOOK_URL;
      if (hook && hook.startsWith("https://hooks.zapier.com/hooks/catch/")) {
        const testEmail = "tippanzsolt@gmail.com";
        const qrValue = "KASTELYDOMB:MENU:" + id;
        const htmlEscape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
        const huDate = (date: string) => new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
        const fulfillmentHu = fulfillment === "delivery" ? "Kiszállítás" : fulfillment === "dine_in" ? "Helyben fogyasztás" : "Elvitel";
        const paymentHu = payment_method === "card_on_pickup" ? "Bankkártya az átvételkor" : payment_method === "company_transfer" ? "Banki átutalás" : "Készpénz az átvételkor";
        const byDay = new Map<string, typeof items>();
        for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) || []), item]);
        const dayCardsHtml = [...byDay.entries()].map(([date, lines]) =>
          "<div style='margin:0 0 14px;padding:16px;background:#faf7f0;border:1px solid #e8dccb;border-radius:10px'>" +
          "<div style='font-size:17px;font-weight:bold;color:#403328;margin-bottom:12px'>" + htmlEscape(huDate(date)) + "</div>" +
          lines.map(line => "<div style='padding:8px 0;border-top:1px solid #e8dccb;font-size:15px;line-height:1.5'>" +
            "<strong>" + htmlEscape(line.menu === "soup" ? "Leves" : line.menu + " menü") + "</strong>: " +
            htmlEscape(line.dish) + "<div style='font-weight:bold;margin-top:3px'>" + line.quantity + " adag</div></div>").join("") + "</div>"
        ).join("");
        const moneyHu = new Intl.NumberFormat("hu-HU").format(total) + " Ft";
        const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&data=" + encodeURIComponent(qrValue);
        const orderHtml = "<div style='background:#f5f1e9;padding:18px 10px;font-family:Arial,Helvetica,sans-serif;color:#403328'><div style='max-width:600px;margin:auto;background:white'>" +
          "<div style='background:#403328;color:#fff;text-align:center;padding:24px 18px'><strong style='font-size:22px'>Kastélydomb Kávézó és Étterem</strong><div style='margin-top:8px'>Napi menü – rendelési összesítő</div></div>" +
          "<div style='padding:24px 18px'><h2 style='font-size:21px'>Rendelési igényét rögzítettük</h2><p>Kedves " + htmlEscape(customer_name) + "! Köszönjük megrendelését. Az étterem külön visszaigazolja annak elfogadását.</p>" +
          "<p><strong>Rendelésazonosító:</strong><br><span style='font-weight:bold;overflow-wrap:anywhere'>" + htmlEscape(order_number) + "</span></p>" +
          "<p><strong>Átvétel módja:</strong> " + fulfillmentHu + (fulfillment === "delivery" ? "<br><strong>Kiszállítási cím:</strong> " + htmlEscape(delivery_address) : "") +
          "<br><strong>Fizetési mód:</strong> " + paymentHu + "</p><h3 style='margin-top:28px'>Megrendelt menük</h3>" + dayCardsHtml +
          "<p style='font-size:21px;font-weight:bold;text-align:right;margin:22px 0'>Összesen: " + moneyHu + "</p>" +
          "<div style='background:#faf7f0;padding:18px 10px;text-align:center'><h3>QR-kód az átvételhez</h3><img alt='Rendelés QR-kódja' src='" + htmlEscape(qrUrl) + "' width='480' style='display:block;width:100%;max-width:480px;height:auto;margin:auto'><p style='font-size:13px'>" + htmlEscape(order_number) + "</p><p style='font-size:14px;line-height:1.5'>Kérjük, őrizze meg ezt az e-mailt! Rendelése átvételekor mutassa be a QR-kódot munkatársunknak.</p></div>" +
          "<p style='font-size:12px;color:#68594c;margin-top:18px'>Ez a levél a rendelési igény beérkezését igazolja, nem a végleges elfogadását.</p></div></div></div>";
        const payload = {
          event: "menu.order.created",
          is_test: true,
          order_id: id,
          order_number,
          customer_name,
          customer_email: testEmail,
          original_recipient_suppressed: true,
          fulfillment,
          delivery_address: fulfillment === "delivery" ? delivery_address : "",
          payment_method,
          items,
          total_huf: total,
          qr_value: qrValue,
          fulfillment_hu: fulfillmentHu,
          payment_method_hu: paymentHu,
          total_hu: moneyHu,
          order_html: orderHtml,
          qr_url: "https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&data=" + encodeURIComponent(qrValue)
        };
        try {
          const sent = await fetch(hook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8000)
          });
          if (!sent.ok) console.error("MENU_ZAPIER_WEBHOOK_HTTP_ERROR", sent.status, order_number);
        } catch {
          console.error("MENU_ZAPIER_WEBHOOK_REQUEST_FAILED", order_number);
        }
      }
    }
    // The order has been persisted. Mail failure must not duplicate or roll back it.
    // Explicitly enable only after verifying SMTP/Resend settings and delivery.
    if (process.env.MENU_EMAIL_ENABLED === "true" && customer_email) {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.MENU_EMAIL_FROM;
      const is_test = isTestMode();
      const recipient = is_test ? "tippanzsolt@gmail.com" : customer_email;
      if (key && from) {
        const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
        const ft = (v: number) => new Intl.NumberFormat("hu-HU").format(v) + " Ft";
        const fulfillmentName = fulfillment === "delivery" ? "Kiszállítás" : fulfillment === "dine_in" ? "Helyben fogyasztás" : "Elvitel";
        const paymentName = payment_method === "card_on_pickup" ? "Bankkártya az átvételkor" : payment_method === "company_transfer" ? "Céges átutalás" : "Készpénz az átvételkor";
        const rows = items.map(i => "<tr><td style='padding:9px 6px;border-bottom:1px solid #eee4d8'>" + esc(i.date) + "</td><td style='padding:9px 6px;border-bottom:1px solid #eee4d8'>" + esc(i.menu==="soup"?"Leves":i.menu+" menü") + " — " + esc(i.dish) + "</td><td style='padding:9px 6px;border-bottom:1px solid #eee4d8;text-align:right'>" + i.quantity + " adag</td></tr>").join("");
        const qrValue = "KASTELYDOMB:MENU:" + id;
        const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&data=" + encodeURIComponent(qrValue);
        const html = "<div style='background:#f5f1e9;padding:18px 10px;font-family:Arial,sans-serif;color:#403328'><table role='presentation' style='width:100%;max-width:600px;margin:auto;background:#fff;border-collapse:collapse'><tr><td style='background:#403328;color:white;text-align:center;padding:26px 18px'><strong style='font-size:22px'>Kastélydomb Kávézó és Étterem</strong><p>Napi menü – rendelési összesítő</p></td></tr><tr><td style='padding:24px 18px'><h2>Rendelési igényét rögzítettük</h2><p>Kedves " + esc(customer_name) + "! Rendelési igényét fogadtuk. Az étterem külön igazolja vissza az elfogadását.</p><p><strong>Rendelésazonosító:</strong><br><span style='display:inline-block;white-space:nowrap;font-weight:bold'>" + esc(order_number) + "</span></p><p><strong>Átvétel módja:</strong> " + esc(fulfillmentName) + (fulfillment === "delivery" ? "<br><strong>Kiszállítási cím:</strong> " + esc(delivery_address) : "") + "<br><strong>Fizetés:</strong> " + esc(paymentName) + "</p><h3>Rendelési összesítő</h3><table role='presentation' style='width:100%;border-collapse:collapse;font-size:13px'>" + rows + "</table><p style='font-size:19px;text-align:right'><strong>Összesen: " + esc(ft(total)) + "</strong></p><div style='background:#faf7f0;text-align:center;padding:20px 8px'><h3>QR-kód az átvételhez</h3><img src='" + esc(qrUrl) + "' alt='Rendelés QR-kódja' width='480' height='480' style='display:block;width:100%;max-width:480px;height:auto;margin:auto'><p>" + esc(order_number) + "</p><p>Kérjük, őrizze meg ezt az e-mailt! Rendelése átvételekor mutassa be a QR-kódot munkatársunknak.</p></div>" + (is_test ? "<p style='font-size:12px'>TESZT – a levél nem a vendégnek lett elküldve.</p>" : "") + "</td></tr><tr><td style='background:#403328;color:white;text-align:center;padding:16px'>Kastélydomb Kávézó és Étterem · Várpalota</td></tr></table></div>";
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: [recipient], subject: (is_test?"[TESZT] ":"") + "Kastélydomb – napi menürendelés – " + order_number, html }),
            signal: AbortSignal.timeout(8000)
          });
        } catch { /* Persisted order remains available for manual follow-up. */ }
      }
    }
    return NextResponse.json(
      { order_number, total_huf: total, is_test:isTestMode() },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "A rendelésfogadás átmenetileg nem elérhető." },
      { status: 503 },
    );
  }
}
