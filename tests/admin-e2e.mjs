// Runs the real Next server/UI against an isolated PostgREST test double.
// Financial SQL invariants are separately tested in database-workflows.sql on Supabase.
import assert from "node:assert/strict";
import http from "node:http";
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(
  require.resolve("playwright", {
    paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()],
  }),
);
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) =>
  nativeFetch(url, { ...options, signal: AbortSignal.timeout(5000) });
const origin = "http://localhost:3100",
  password = "test-password-for-local-only";
const id = randomUUID();
const future = new Date();
future.setUTCDate(future.getUTCDate() + 14 + ((8 - future.getUTCDay()) % 7));
const menuStart = future.toISOString().slice(0, 10);
const artifacts =
  process.env.TEST_ARTIFACT_DIR || process.cwd() + "/test-results";
mkdirSync(artifacts, { recursive: true });
const state = {
  orders: [
    {
      id,
      order_number: "TEST-1001",
      customer_name: "Teszt Vendég",
      customer_phone: "+36300000000",
      customer_email: "test@example.test",
      customer_type: "private",
      company_name: null,
      fulfillment: "delivery",
      delivery_address: "Teszt utca 1.",
      payment_method: "cash_on_pickup",
      payment_status: "unpaid",
      status: "new",
      total_huf: 5000,
      items: [
        { date: "2026-10-29", menu: "C", dish: "Teszt étel", quantity: 2 },
      ],
      created_at: new Date().toISOString(),
    },
  ],
  drivers: [],
  payments: [],
  assignments: [],
  settlements: [],
  menu_weeks: [],
  admin_sessions: [],
};
let loginCount = 0;
const db = http.createServer(async (req, res) => {
  try {
    let raw = "";
    for await (const c of req) raw += c;
    const b = raw ? JSON.parse(raw) : {};
    const u = new URL(req.url, "http://localhost:3101");
    const path = u.pathname.replace("/rest/v1/", "");
    let out;
    if (path.startsWith("rpc/")) {
      switch (path.slice(4)) {
        case "kd_rate_limit":
          out = ++loginCount < 100;
          break;
        case "kd_driver": {
          const d = {
            id: b.p_id || randomUUID(),
            name: b.p_name,
            phone: b.p_phone,
            area: b.p_area,
            active: b.p_active,
          };
          state.drivers = state.drivers.filter((x) => x.id !== d.id).concat(d);
          out = d;
          break;
        }
        case "kd_assign":
          out = {
            id: randomUUID(),
            order_id: b.p_order,
            driver_id: b.p_driver,
          };
          state.assignments = state.assignments
            .filter((x) => x.order_id !== b.p_order)
            .concat(out);
          break;
        case "kd_payment": {
          const o = state.orders.find((x) => x.id === b.p_order);
          out = state.payments.find((x) => x.request_id === b.p_request);
          if (!out) {
            out = {
              id: randomUUID(),
              order_id: b.p_order,
              driver_id: b.p_driver,
              amount_huf: b.p_amount,
              method: b.p_method,
              request_id: b.p_request,
              created_at: new Date().toISOString(),
            };
            state.payments.push(out);
            const sum = state.payments
              .filter((x) => x.order_id === o.id)
              .reduce((n, x) => n + x.amount_huf, 0);
            o.payment_status = sum === o.total_huf ? "paid" : "pending";
          }
          break;
        }
        case "kd_order_status":
          out = state.orders.find((x) => x.id === b.p_order);
          out.status = b.p_status;
          break;
        case "kd_menu":
          out = {
            id: randomUUID(),
            week_start: b.p_start,
            days: b.p_days,
            published: b.p_published,
          };
          state.menu_weeks = state.menu_weeks
            .filter((x) => x.week_start !== b.p_start)
            .concat(out);
          break;
        default:
          throw Error("Unexpected RPC " + path);
      }
    } else {
      const key = path.replace("kastelydomb_", "");
      const rows = state[key];
      if (!rows) throw Error("Unknown table " + path);
      const filtered = rows.filter((x) =>
        [...u.searchParams].every(
          ([k, v]) => !v.startsWith("eq.") || String(x[k]) === v.slice(3),
        ),
      );
      if (req.method === "POST") {
        b.created_at ||= new Date().toISOString();
        rows.push(b);
        out = [b];
      } else if (req.method === "DELETE") {
        state[key] = rows.filter((x) => !filtered.includes(x));
        out = [];
      } else out = filtered;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(out));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: e.message }));
  }
});
await new Promise((r) => db.listen(3101, r));
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      ADMIN_PASSWORD: password,
      SUPABASE_URL: "http://localhost:3101",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
      ORDER_INTAKE_ENABLED: "false",
      CLIENT_TEST_ORDERS_ENABLED:"true",
      KASTELYDOMB_MODE:"test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (c) => {
  output += c;
  console.log(String(c));
});
server.stderr.on("data", (c) => {
  output += c;
  console.error(String(c));
});
let browser;
const checks = [];
checks.push = (...v) => {
  console.log("PASS", ...v);
  return Array.prototype.push.apply(checks, v);
};
try {
  for (let i = 0; i < 10; i++) {
    try {
      if ((await fetch(origin + "/admin")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  let r = await fetch(origin + "/api/admin/orders");
  assert.equal(r.status, 401);
  checks.push("Unauthorized read denied");
  r = await fetch(origin + "/api/admin/session", {
    method: "POST",
    headers: {
      Origin: "https://wrong.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  assert.equal(r.status, 403);
  checks.push("Cross-origin login denied");
  r = await fetch(origin + "/api/admin/session", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" }),
  });
  assert.equal(r.status, 401);
  checks.push("Wrong password denied");
  r = await fetch(origin + "/api/admin/session", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=strict/i);
  checks.push("Secure HttpOnly session issued");
  const headers = {
    Cookie: cookie.split(";")[0],
    Origin: origin,
    "Content-Type": "application/json",
  };
  r = await fetch(origin + "/api/admin/orders/" + id, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ payment_status: "paid" }),
  });
  assert.equal(r.status, 400);
  checks.push("Direct paid-status override denied");
  r = await fetch(origin + "/api/admin/operations", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "payment",
      order_id: id,
      amount_huf: -1,
      method: "cash",
      request_id: randomUUID(),
    }),
  });
  assert.equal(r.status, 400);
  checks.push("Invalid payment denied");
  r = await fetch(origin + "/api/admin/session", { method: "DELETE", headers });
  assert.equal(r.status, 200);
  r = await fetch(origin + "/api/admin/orders", { headers });
  assert.equal(r.status, 401);
  checks.push("Logout revokes session");
  const systemStatus=await (await fetch(origin+"/api/system-status")).json();
  assert.equal(systemStatus.mode,"test");assert.equal(systemStatus.order_intake_enabled,true);
  checks.push("Client test mode uses a separate order switch");
  browser = await chromium.launch({
    executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto(origin + "/admin");
  await page.getByLabel("Adminjelszó").fill(password);
  await page.getByRole("button", { name: "Belépés", exact: true }).click();
  await page.getByRole("heading", { name: "Kezdőlap", exact: true }).waitFor();
  assert.equal(await page.getByRole("note",{name:"Tesztüzem",exact:true}).isVisible(),true);
  checks.push("Browser login and dashboard");
  await page
    .getByRole("button", { name: "Futárok", exact: false })
    .first()
    .click();
  await page.getByLabel("Név", { exact: true }).fill("Teszt Futár");
  await page.getByLabel("Telefonszám", { exact: true }).fill("+36301112222");
  await page.getByLabel("Terület", { exact: true }).fill("Várpalota");
  await page.getByRole("button", { name: "Futár mentése" }).click();
  await page.getByRole("cell", { name: "Teszt Futár", exact: true }).waitFor();
  checks.push("Driver creation via browser/API");
  await page
    .getByRole("button", { name: "Kiszállítások", exact: false })
    .first()
    .click();
  await page.getByLabel("Futár: TEST-1001").selectOption(state.drivers[0].id);
  await page.getByRole("status").waitFor();
  assert.equal(state.assignments[0].driver_id, state.drivers[0].id);
  checks.push("Delivery assignment");
  await page
    .getByRole("button", { name: "Fizetések", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Befizetés", exact: true }).click();
  await page.getByLabel("Befizetett összeg (Ft)").fill("2000");
  await page.getByLabel("Átvevő").selectOption(state.drivers[0].id);
  await page.getByRole("button", { name: "Befizetés mentése" }).click();
  await page.getByRole("status").waitFor();
  assert.equal(state.payments.length, 1);
  assert.equal(state.orders[0].payment_status, "pending");
  checks.push("Partial payment via browser/API");
  await page
    .getByRole("button", { name: "Ügyfelek", exact: false })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Megrendelők", exact: true })
    .waitFor();
  await page.getByRole("cell", { name: "Teszt Vendég", exact: true }).waitFor();
  checks.push("Customer view");
  await page
    .getByRole("button", { name: "Riportok", exact: false })
    .first()
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV letöltése" }).click();
  assert.equal(
    (await download).suggestedFilename(),
    "kastelydomb-rendelesek.csv",
  );
  checks.push("Report CSV export");
  await page
    .getByRole("button", { name: "Étlap és menük", exact: false })
    .first()
    .click();
  await page.getByLabel("Hét kezdete (hétfő)").fill(menuStart);
  for (const group of await page.locator("fieldset").all()) {
    const inputs = group.locator("input");
    for (let i = 0; i < 4; i++)
      await inputs.nth(i).fill(i === 0 ? "Teszt leves" : "Teszt fogás " + i);
  }
  await page.getByLabel("Megjelenés").selectOption("true");
  await page.getByRole("button", { name: "Heti menü mentése" }).click();
  await page.getByRole("status").waitFor();
  assert.equal(state.menu_weeks[0].published, true);
  checks.push("Five-day menu save and publish");
  r = await fetch(origin + "/api/menu");
  const menu = await r.json();
  assert.equal(menu.weeks[0].week_start, menuStart);
  assert.equal(menu.intake_enabled,true);
  checks.push("Published menu public API");
  await page.goto(origin + "/napi-menu");
  await page.getByRole("tab", { name: new RegExp(menuStart) }).waitFor();
  checks.push("Published menu rendered in existing public ordering screen");
  const request = {
    request_id: randomUUID(),
    customer_name: "Teszt Rendelő",
    customer_phone: "+36300000000",
    customer_type: "private",
    fulfillment: "pickup",
    payment_method: "cash_on_pickup",
    plan: "no",
    total_huf:1,
    delivery_address:"Nem kiszállítási cím",
    days: [{ date: menuStart, A: 0, B: 0, C: 2, soup: 2 }],
  };
  for(const [name,patch] of [
    ["Online card rejected",{payment_method:"online_card"}],
    ["Private transfer rejected",{payment_method:"company_transfer"}],
    ["Missing company billing rejected",{customer_type:"company",company_name:"Teszt Kft."}],
    ["Soup-only order rejected",{days:[{date:menuStart,A:0,B:0,C:0,soup:1}]}],
    ["C menu without soup rejected",{days:[{date:menuStart,A:0,B:0,C:1,soup:0}]}],
    ["Single-day subscription rejected",{plan:"yes"}],
    ["Unknown menu date rejected",{days:[{date:"1900-01-01",A:0,B:0,C:1,soup:1}]}]
  ]) {const invalid=await fetch(origin+"/api/orders",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({...request,...patch,request_id:randomUUID()})});assert.equal(invalid.status,400,name);checks.push(name)}
  r = await fetch(origin + "/api/orders", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  assert.equal(r.status, 201);
  let order = await r.json();
  assert.equal(order.total_huf, 5600);
  assert.equal(order.is_test,true);
  assert.equal(state.orders.find(x=>x.id===request.request_id).delivery_address,null);
  assert.equal(
    state.orders
      .find((x) => x.id === request.request_id)
      .items.find((x) => x.menu === "soup").quantity,
    2,
  );
  r = await fetch(origin + "/api/orders", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  assert.equal(r.status, 200);
  assert.equal(
    state.orders.filter((x) => x.id === request.request_id).length,
    1,
  );
  checks.push("Order intake: server price, soup quantity, idempotent retry");
  await page.goto(origin + "/admin");
  await page.getByLabel("Adminjelszó").fill(password);
  await page.getByRole("button", { name: "Belépés", exact: true }).click();
  await page.getByRole("heading", { name: "Kezdőlap", exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".kd-admin .shell")
      .evaluate((el) => el.getBoundingClientRect().left),
    0,
  );
  await page.screenshot({
    path: artifacts + "/admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "☰" }).click();
  await page
    .getByRole("button", { name: "Futárok", exact: false })
    .first()
    .click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 0,
  );
  await page.screenshot({
    path: artifacts + "/admin-mobile.png",
    fullPage: true,
  });
  checks.push("Mobile navigation, viewport overflow");
  assert.deepEqual(errors, []);
  checks.push("No browser runtime errors");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (e) {
  console.error(output.slice(-2500));
  throw e;
} finally {
  await browser?.close();
  server.kill("SIGKILL");
  db.closeAllConnections();
  db.close();
}
