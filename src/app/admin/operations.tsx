"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuDay } from "@/lib/menu";
type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_type: string;
  company_name: string | null;
  company_address?: string | null;
  tax_number?: string | null;
  fulfillment: string;
  delivery_address: string | null;
  status: string;
  total_huf: number;
  payment_status: string;
  created_at: string;
  items: { date: string; menu: string; dish: string; quantity: number }[];
};
type Driver = {
  id: string;
  name: string;
  phone: string;
  area: string;
  active: boolean;
};
type Payment = {
  id: string;
  order_id: string;
  driver_id: string | null;
  amount_huf: number;
  method: string;
  created_at: string;
};
type Assignment = { id: string; order_id: string; driver_id: string };
type Settlement = {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  cash_huf: number;
  card_huf: number;
  unpaid_huf: number;
  order_count: number;
};
type Menu = { week_start: string; days: MenuDay[]; published: boolean };
type State = {
  drivers: Driver[];
  assignments: Assignment[];
  payments: Payment[];
  settlements: Settlement[];
  menus: Menu[];
};
const empty: State = {
  drivers: [],
  assignments: [],
  payments: [],
  settlements: [],
  menus: [],
};
const money = (n: number) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(n);
const date = (s: string) =>
  new Date(s).toLocaleString("hu-HU", { timeZone: "Europe/Budapest" });
const dayNames = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];
function daysFor(start: string): MenuDay[] {
  const d = new Date(start + "T00:00:00Z");
  if (!Number.isFinite(+d)) return [];
  return dayNames.map((label, i) => {
    const at = new Date(d);
    at.setUTCDate(at.getUTCDate() + i);
    return {
      date: at.toISOString().slice(0, 10),
      label,
      soup: "",
      A: null,
      B: null,
      C: null,
    };
  });
}
export default function Operations({
  view,
  orders,
  revision,
  refresh,
}: {
  view: string;
  orders: Order[];
  revision: number;
  refresh: () => Promise<void>;
}) {
  const [state, setState] = useState<State>(empty),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [search, setSearch] = useState("");
  const [driver, setDriver] = useState({
    id: "",
    name: "",
    phone: "",
    area: "",
    active: true,
  });
  const [payment, setPayment] = useState({
    order_id: "",
    driver_id: "",
    amount_huf: "",
    method: "cash",
  });
  const [paymentKey, setPaymentKey] = useState<string | null>(null);
  const [settle, setSettle] = useState({
    driver_id: "",
    period_start: "",
    period_end: "",
  });
  const [start, setStart] = useState(""),
    [days, setDays] = useState<MenuDay[]>([]),
    [published, setPublished] = useState(false);
  const [range, setRange] = useState({ start: "", end: "" });
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/operations", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw Error(j.error);
    setState(j);
    setLoaded(true);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/operations", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        return j;
      })
      .then((j) => {
        setState(j);
        setLoaded(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  const mutate = async (data: object) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      await load();
      await refresh();
      setSuccess("A művelet mentése sikerült.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentési hiba.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const paymentTotals = useMemo(() => {
    const sums = new Map<string, number>();
    for (const p of state.payments)
      sums.set(p.order_id, (sums.get(p.order_id) || 0) + p.amount_huf);
    return sums;
  }, [state.payments]);
  const paid = (id: string) => paymentTotals.get(id) || 0;
  const debt = (o: Order) => Math.max(0, o.total_huf - paid(o.id));
  const driverName = (id: string | null) =>
    state.drivers.find((d) => d.id === id)?.name || "Étterem";
  const assignment = (id: string) =>
    state.assignments.find((a) => a.order_id === id);
  const matches = (v: unknown) =>
    String(v).toLocaleLowerCase("hu").includes(search.toLocaleLowerCase("hu"));
  const editWeek = (value: string) => {
    setStart(value);
    const menu = state.menus.find((m) => m.week_start === value);
    setDays(menu ? menu.days : daysFor(value));
    setPublished(menu?.published || false);
  };
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const reportOrders = activeOrders.filter((o) => {
    const d = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Budapest",
    }).format(new Date(o.created_at));
    return (!range.start || d >= range.start) && (!range.end || d <= range.end);
  });
  const exportCsv = () => {
    const rows = [
      [
        "Rendelésszám",
        "Név",
        "Létrehozva",
        "Összeg (Ft)",
        "Befizetés (Ft)",
        "Hátralék (Ft)",
        "Státusz",
      ],
      ...reportOrders.map((o) => [
        o.order_number,
        o.customer_name,
        date(o.created_at),
        o.total_huf,
        paid(o.id),
        debt(o),
        o.status,
      ]),
    ];
    const content =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+@\-\t\r]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kastelydomb-rendelesek.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="panel">
      <style>{`.kd-admin .ops-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.kd-admin .ops-form{max-width:700px;display:grid;gap:12px;margin:20px 0}.kd-admin .ops-form label{display:grid;gap:5px}.kd-admin .ops-form input,.kd-admin .ops-form select{width:100%;box-sizing:border-box}.kd-admin .ops-note{padding:12px;background:#f2f8e8;color:#365523}.kd-admin .menu-day{border:1px solid #e4d7cc;padding:14px;border-radius:8px}.kd-admin .ops-actions{display:flex;flex-wrap:wrap;gap:10px;margin:15px 0}`}</style>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="ops-note" role="status">
          {success}
        </p>
      )}
      {!loaded ? (
        <p>Adatok betöltése…</p>
      ) : (
        <>
          {view !== "settings" && view !== "menus" && (
            <input
              aria-label="Modul keresése"
              placeholder="Keresés…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {view === "drivers" && (
            <>
              <h2>Futárok</h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Név</th>
                      <th>Telefon</th>
                      <th>Terület</th>
                      <th>Állapot</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.drivers
                      .filter((d) =>
                        matches(d.name + " " + d.phone + " " + d.area),
                      )
                      .map((d) => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          <td>{d.phone}</td>
                          <td>{d.area}</td>
                          <td>{d.active ? "Aktív" : "Inaktív"}</td>
                          <td>
                            <button onClick={() => setDriver(d)}>
                              Szerkesztés
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <h2>{driver.id ? "Futár szerkesztése" : "Új futár"}</h2>
              <form
                className="ops-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await mutate({ action: "driver", ...driver }))
                    setDriver({
                      id: "",
                      name: "",
                      phone: "",
                      area: "",
                      active: true,
                    });
                }}
              >
                <label>
                  Név
                  <input
                    required
                    maxLength={120}
                    value={driver.name}
                    onChange={(e) =>
                      setDriver({ ...driver, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Telefonszám
                  <input
                    required
                    type="tel"
                    value={driver.phone}
                    onChange={(e) =>
                      setDriver({ ...driver, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Terület
                  <input
                    maxLength={180}
                    value={driver.area}
                    onChange={(e) =>
                      setDriver({ ...driver, area: e.target.value })
                    }
                  />
                </label>
                <label>
                  Állapot
                  <select
                    value={String(driver.active)}
                    onChange={(e) =>
                      setDriver({
                        ...driver,
                        active: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">Aktív</option>
                    <option value="false">Inaktív</option>
                  </select>
                </label>
                <button className="primary" disabled={busy}>
                  Futár mentése
                </button>
              </form>
              <h2>Futárelszámolás lezárása</h2>
              <p className="muted">
                Lezárult napok tényleges befizetései alapján. A hátralék az
                időszak végére számított pillanatkép. Az egymást átfedő
                időszakok nem zárhatók le kétszer.
              </p>
              <form
                className="ops-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate({ action: "settle", ...settle });
                }}
              >
                <label>
                  Futár
                  <select
                    required
                    value={settle.driver_id}
                    onChange={(e) =>
                      setSettle({ ...settle, driver_id: e.target.value })
                    }
                  >
                    <option value="">Válasszon</option>
                    {state.drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Időszak kezdete
                  <input
                    required
                    type="date"
                    value={settle.period_start}
                    onChange={(e) =>
                      setSettle({ ...settle, period_start: e.target.value })
                    }
                  />
                </label>
                <label>
                  Időszak vége
                  <input
                    required
                    type="date"
                    value={settle.period_end}
                    onChange={(e) =>
                      setSettle({ ...settle, period_end: e.target.value })
                    }
                  />
                </label>
                <button disabled={busy}>Végleges elszámolás mentése</button>
              </form>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Futár</th>
                      <th>Időszak</th>
                      <th>Készpénz</th>
                      <th>Bankkártya</th>
                      <th>Hátralék</th>
                      <th>Rendelések</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.settlements.map((s) => (
                      <tr key={s.id}>
                        <td>{driverName(s.driver_id)}</td>
                        <td>
                          {s.period_start} – {s.period_end}
                        </td>
                        <td>{money(s.cash_huf)}</td>
                        <td>{money(s.card_huf)}</td>
                        <td>{money(s.unpaid_huf)}</td>
                        <td>{s.order_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {view === "deliveries" && (
            <>
              <h2>Futár-hozzárendelés</h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rendelés</th>
                      <th>Vendég / cím</th>
                      <th>Napok</th>
                      <th>Állapot</th>
                      <th>Futár</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders
                      .filter(
                        (o) =>
                          o.fulfillment === "delivery" &&
                          matches(
                            o.order_number +
                              " " +
                              o.customer_name +
                              " " +
                              o.delivery_address,
                          ),
                      )
                      .map((o) => (
                        <tr key={o.id}>
                          <td>{o.order_number}</td>
                          <td>
                            {o.customer_name}
                            <br />
                            {o.delivery_address}
                          </td>
                          <td>
                            {[...new Set(o.items.map((i) => i.date))].join(
                              ", ",
                            )}
                          </td>
                          <td>{o.status}</td>
                          <td>
                            <select
                              aria-label={"Futár: " + o.order_number}
                              disabled={busy || o.status === "completed"}
                              value={assignment(o.id)?.driver_id || ""}
                              onChange={(e) =>
                                void mutate({
                                  action: "assign",
                                  order_id: o.id,
                                  driver_id: e.target.value,
                                })
                              }
                            >
                              <option value="">Nincs hozzárendelve</option>
                              {state.drivers
                                .filter(
                                  (d) =>
                                    d.active ||
                                    d.id === assignment(o.id)?.driver_id,
                                )
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                    {!d.active ? " (inaktív)" : ""}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {(view === "payments" || view === "receivables") && (
            <>
              <h2>
                {view === "payments" ? "Befizetés rögzítése" : "Kintlévőségek"}
              </h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rendelés</th>
                      <th>Vendég / cég</th>
                      <th>Összeg</th>
                      <th>Befizetve</th>
                      <th>Hátralék</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders
                      .filter(
                        (o) =>
                          (view !== "receivables" || debt(o) > 0) &&
                          matches(
                            o.customer_name +
                              " " +
                              o.company_name +
                              " " +
                              o.order_number,
                          ),
                      )
                      .map((o) => (
                        <tr key={o.id}>
                          <td>{o.order_number}</td>
                          <td>
                            {o.customer_name}
                            <br />
                            {o.company_name}
                          </td>
                          <td>{money(o.total_huf)}</td>
                          <td>{money(paid(o.id))}</td>
                          <td>{money(debt(o))}</td>
                          <td>
                            <button
                              disabled={debt(o) === 0}
                              onClick={() => {
                                setPayment({
                                  order_id: o.id,
                                  amount_huf: String(debt(o)),
                                  driver_id: "",
                                  method: "cash",
                                });
                                setPaymentKey(crypto.randomUUID());
                              }}
                            >
                              Befizetés
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {payment.order_id && (
                <form
                  className="ops-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const key = paymentKey || crypto.randomUUID();
                    setPaymentKey(key);
                    if (
                      await mutate({
                        action: "payment",
                        ...payment,
                        amount_huf: Number(payment.amount_huf),
                        request_id: key,
                      })
                    ) {
                      setPayment({
                        order_id: "",
                        driver_id: "",
                        amount_huf: "",
                        method: "cash",
                      });
                      setPaymentKey(null);
                    }
                  }}
                >
                  <h2>
                    {
                      orders.find((o) => o.id === payment.order_id)
                        ?.order_number
                    }
                  </h2>
                  <label>
                    Befizetett összeg (Ft)
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      max={debt(orders.find((o) => o.id === payment.order_id)!)}
                      value={payment.amount_huf}
                      onChange={(e) => {
                        setPaymentKey(crypto.randomUUID());
                        setPayment({ ...payment, amount_huf: e.target.value });
                      }}
                    />
                  </label>
                  <label>
                    Mód
                    <select
                      value={payment.method}
                      onChange={(e) => {
                        setPaymentKey(crypto.randomUUID());
                        setPayment({
                          ...payment,
                          method: e.target.value,
                          driver_id:
                            e.target.value === "transfer"
                              ? ""
                              : payment.driver_id,
                        });
                      }}
                    >
                      <option value="cash">Készpénz</option>
                      <option value="card">Bankkártya</option>
                      {orders.find((o) => o.id === payment.order_id)
                        ?.customer_type === "company" && (
                        <option value="transfer">Átutalás</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Átvevő
                    <select
                      value={payment.driver_id}
                      onChange={(e) => {
                        setPaymentKey(crypto.randomUUID());
                        setPayment({ ...payment, driver_id: e.target.value });
                      }}
                    >
                      <option value="">Étterem</option>
                      {payment.method !== "transfer" &&
                        state.drivers
                          .filter(
                            (d) =>
                              d.id === assignment(payment.order_id)?.driver_id,
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    Befizetés mentése
                  </button>
                </form>
              )}
              <h2>Befizetési napló</h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Időpont</th>
                      <th>Rendelés</th>
                      <th>Összeg</th>
                      <th>Mód</th>
                      <th>Átvevő</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.payments
                      .filter((p) =>
                        matches(
                          orders.find((o) => o.id === p.order_id)?.order_number,
                        ),
                      )
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .map((p) => (
                        <tr key={p.id}>
                          <td>{date(p.created_at)}</td>
                          <td>
                            {
                              orders.find((o) => o.id === p.order_id)
                                ?.order_number
                            }
                          </td>
                          <td>{money(p.amount_huf)}</td>
                          <td>
                            {
                              {
                                cash: "Készpénz",
                                card: "Bankkártya",
                                transfer: "Átutalás",
                              }[p.method]
                            }
                          </td>
                          <td>{driverName(p.driver_id)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {view === "customers" && (
            <>
              <h2>Megrendelők</h2>
              <p className="muted">
                Rendelésekből képzett névjegyzék, telefonszám és e-mail alapján
                összevonva.
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Név</th>
                      <th>Telefon</th>
                      <th>E-mail</th>
                      <th>Cég / számlázás</th>
                      <th>Rendelések</th>
                      <th>Hátralék</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      new Map(
                        orders.map((o) => [
                          (o.customer_phone || "") +
                            "|" +
                            (o.customer_email || ""),
                          o,
                        ]),
                      ).entries(),
                    )
                      .filter(([, o]) =>
                        matches(
                          o.customer_name +
                            " " +
                            o.company_name +
                            " " +
                            o.customer_phone,
                        ),
                      )
                      .map(([key, o]) => {
                        const group = activeOrders.filter(
                          (x) =>
                            (x.customer_phone || "") +
                              "|" +
                              (x.customer_email || "") ===
                            key,
                        );
                        return (
                          <tr key={key}>
                            <td>{o.customer_name}</td>
                            <td>{o.customer_phone}</td>
                            <td>{o.customer_email}</td>
                            <td>
                              {o.company_name}
                              <br />
                              {o.company_address}
                              <br />
                              {o.tax_number}
                            </td>
                            <td>{group.length}</td>
                            <td>
                              {money(group.reduce((n, x) => n + debt(x), 0))}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {view === "reports" && (
            <>
              <h2>Rendelési riport</h2>
              <div className="ops-actions">
                <label>
                  Kezdete{" "}
                  <input
                    type="date"
                    value={range.start}
                    onChange={(e) =>
                      setRange({ ...range, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  Vége{" "}
                  <input
                    type="date"
                    min={range.start}
                    value={range.end}
                    onChange={(e) =>
                      setRange({ ...range, end: e.target.value })
                    }
                  />
                </label>
                <button onClick={exportCsv}>CSV letöltése</button>
                <button onClick={() => window.print()}>Nyomtatás</button>
              </div>
              <p>
                {reportOrders.length} rendelés · Érték:{" "}
                {money(reportOrders.reduce((n, o) => n + o.total_huf, 0))} ·
                Befizetve:{" "}
                {money(reportOrders.reduce((n, o) => n + paid(o.id), 0))} ·
                Hátralék: {money(reportOrders.reduce((n, o) => n + debt(o), 0))}
              </p>
              <p className="muted">
                A szűrés a rendelés létrehozásának budapesti dátuma szerint
                történik. A befizetések a kiválasztott rendelések jelenlegi
                egyenlegét mutatják. Lemondott rendelések nélkül.
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rendelés</th>
                      <th>Név</th>
                      <th>Összeg</th>
                      <th>Befizetve</th>
                      <th>Hátralék</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportOrders
                      .filter((o) => matches(o.customer_name + o.order_number))
                      .map((o) => (
                        <tr key={o.id}>
                          <td>{o.order_number}</td>
                          <td>{o.customer_name}</td>
                          <td>{money(o.total_huf)}</td>
                          <td>{money(paid(o.id))}</td>
                          <td>{money(debt(o))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {view === "menus" && (
            <>
              <h2>Heti menü szerkesztése</h2>
              <p className="muted">
                Mentés piszkozatként vagy publikálás a meglévő vendégoldali
                menürendelőbe. Az árak változatlanok. Ünnepnapi eltérő árazás
                még nem publikálható.
              </p>
              <label className="field">
                Mentett hetek
                <select
                  value={start}
                  onChange={(e) => editWeek(e.target.value)}
                >
                  <option value="">Válasszon vagy adjon meg új hétfőt</option>
                  {state.menus.map((m) => (
                    <option key={m.week_start} value={m.week_start}>
                      {m.week_start} · {m.published ? "Publikált" : "Piszkozat"}
                    </option>
                  ))}
                </select>
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate({
                    action: "menu",
                    week_start: start,
                    days,
                    published,
                  });
                }}
              >
                <label className="field">
                  Hét kezdete (hétfő)
                  <input
                    type="date"
                    required
                    value={start}
                    onChange={(e) => editWeek(e.target.value)}
                  />
                </label>
                <div className="ops-grid">
                  {days.map((d, i) => (
                    <fieldset className="menu-day" key={d.date}>
                      <legend>
                        {d.label} · {d.date}
                      </legend>
                      {(["soup", "A", "B", "C"] as const).map((k) => (
                        <label className="field" key={k}>
                          {k === "soup"
                            ? "Leves"
                            : k + " menü (üres = nem rendelhető)"}
                          <input
                            required={k === "soup"}
                            maxLength={300}
                            value={d[k] || ""}
                            onChange={(e) =>
                              setDays((old) =>
                                old.map((v, j) =>
                                  j === i
                                    ? { ...v, [k]: e.target.value || null }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                <label className="field">
                  Megjelenés
                  <select
                    value={String(published)}
                    onChange={(e) => setPublished(e.target.value === "true")}
                  >
                    <option value="false">Piszkozat</option>
                    <option value="true">Publikált</option>
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={busy || days.length !== 5}
                >
                  Heti menü mentése
                </button>{" "}
                <a href="/napi-menu" target="_blank" rel="noreferrer">
                  Vendégoldali előnézet ↗
                </a>
              </form>
            </>
          )}
          {view === "settings" && (
            <>
              <h2>Rendszerállapot</h2>
              <p>
                Adatforrás: Kastélydomb Supabase. A belépés 8 órás,
                szerveroldalon visszavonható munkamenetet használ. A módosítások
                auditnaplóba kerülnek.
              </p>
              <p>
                Fizetés: készpénz, átvételkori bankkártya, céges átutalás. Az
                online fizetés és a Számlázz.hu későbbi integráció.
              </p>
              <p>
                Az online rendelésfogadás külön szerveroldali kapcsolóval
                engedélyezhető a tesztek után.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
