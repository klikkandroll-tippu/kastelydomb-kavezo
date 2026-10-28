"use client";
import { inPeriod } from "@/lib/menu";
import Operations from "./operations";
import ModeBanner from "./mode-banner";
import { useCallback, useEffect, useMemo, useState } from "react";
type Order = {
  is_test?: boolean;
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_type: string;
  company_name: string | null;
  fulfillment: "pickup" | "delivery" | "dine_in";
  delivery_address: string | null;
  payment_method:
    | "cash_on_pickup"
    | "card_on_pickup"
    | "online_card"
    | "company_transfer";
  payment_status: "unpaid" | "pending" | "paid";
  status:
    | "new"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled";
  total_huf: number;
  paid_huf?: number;
  items: {
    date: string;
    menu: string;
    dish: string;
    quantity: number;
    soup?: string;
  }[];
  notes: string | null;
  created_at: string;
};
const status: Record<Order["status"], string> = {
  new: "Új",
  confirmed: "Visszaigazolt",
  preparing: "Előkészítés alatt",
  ready: "Átadásra kész",
  completed: "Teljesített",
  cancelled: "Lemondott",
};
const payment: Record<Order["payment_method"], string> = {
  cash_on_pickup: "Készpénz átvételkor",
  card_on_pickup: "Bankkártya átvételkor",
  online_card: "Online bankkártya (később)",
  company_transfer: "Céges átutalás",
};
const delivery: Record<Order["fulfillment"], string> = {
  pickup: "Elvitel",
  delivery: "Kiszállítás",
  dine_in: "Helyben",
};
const money = (n: number) => new Intl.NumberFormat("hu-HU").format(n) + " Ft";
const navigation = [
  ["home", "Kezdőlap", "⌂"],
  ["menus", "Étlap és menük", "♜"],
  ["orders", "Megrendelések", "▣"],
  ["customers", "Ügyfelek", "♙"],
  ["drivers", "Futárok", "♧"],
  ["deliveries", "Kiszállítások", "▤"],
  ["payments", "Fizetések", "▰"],
  ["receivables", "Kintlévőségek", "▥"],
  ["reports", "Riportok", "▥"],
  ["settings", "Beállítások", "⚙"],
] as const;
type View = (typeof navigation)[number][0];
export default function AdminPage() {
  const [revision, setRevision] = useState(0);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false),
    [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [view, setView] = useState<View>("home"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly"),
    [selected, setSelected] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [sidebar, setSidebar] = useState(false);
  const api = useCallback(
    async (method = "GET", id?: string, body?: object) => {
      const r = await fetch(
        "/api/admin/orders" + (id ? "/" + encodeURIComponent(id) : ""),
        {
          method,
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || "A kiszolgáló nem érhető el.");
      return j;
    },
    [],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!authed) {
        const r = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        setPassword("");
      }
      const d = await api();
      setOrders(d.orders || []);
      setRevision((v) => v + 1);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }, [api, authed, password]);
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(
      () =>
        api()
          .then((d) => setOrders(d.orders || []))
          .catch((e) => setError(e.message)),
      30000,
    );
    return () => clearInterval(t);
  }, [authed, api]);
  const refresh = async () => {
    const d = await api();
    setOrders(d.orders || []);
    setRevision((v) => v + 1);
  };
  const now = new Date();
  const scoped = useMemo(
    () => orders.filter((o) => inPeriod(o.created_at, period)),
    [orders, period],
  );
  const shown = useMemo(
    () =>
      scoped.filter(
        (o) =>
          (filter === "all" || filter === o.status) &&
          [
            o.customer_name,
            o.order_number,
            o.customer_phone || "",
            o.company_name || "",
            o.delivery_address || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (view !== "deliveries" || o.fulfillment === "delivery") &&
          (view !== "receivables" || o.payment_status !== "paid") &&
          (view !== "payments" || true),
      ),
    [scoped, filter, query, view],
  );
  const active = orders.find((o) => o.id === selected) || null;
  const unpaid = scoped.filter(
    (o) => o.payment_status !== "paid" && o.status !== "cancelled",
  );
  const total = scoped
    .filter((o) => o.status !== "cancelled")
    .reduce((v, o) => v + o.total_huf, 0);
  const change = async (body: object) => {
    if (!active) return;
    setSaving(true);
    setError("");
    try {
      const j = await api("PATCH", active.id, body);
      setOrders((old) =>
        old.map((o) =>
          o.id === active.id ? { ...j.order, paid_huf: o.paid_huf } : o,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentési hiba");
    } finally {
      setSaving(false);
    }
  };
  const logout = async () => {
    const r = await fetch("/api/admin/session", { method: "DELETE" });
    if (!r.ok) {
      setError("A kijelentkezés nem sikerült.");
      return;
    }
    setPassword("");
    setAuthed(false);
    setOrders([]);
    setSelected(null);
  };
  const title: Record<View, string> = {
    home: "Kezdőlap",
    menus: "Étlap és menük",
    orders: "Megrendelések",
    customers: "Ügyfelek",
    drivers: "Futárok",
    deliveries: "Kiszállítások",
    payments: "Fizetések",
    receivables: "Kintlévőségek",
    reports: "Riportok",
    settings: "Beállítások",
  };
  const selectView = (v: View) => {
    setView(v);
    setSelected(null);
    setSidebar(false);
  };
  const nameOf = (o: Order) => o.customer_name;
  return (
    <main className="kd-admin">
      <ModeBanner />
      <style>{`
.kd-admin{--dark:#291c14;--brown:#513523;--orange:#c84820;--bg:#f8f7f4;--line:#e8e2dd;min-height:100vh;background:var(--bg);color:#26201c;font:14px/1.5 Arial,Helvetica,sans-serif}.kd-admin *{box-sizing:border-box}.kd-admin h1,.kd-admin h2,.kd-admin h3,.kd-admin p{margin:0}.kd-admin h1,.kd-admin h2,.kd-admin h3{font-family:Arial,Helvetica,sans-serif}.kd-admin .metric>div{min-width:0}.kd-admin .metric p{overflow-wrap:anywhere}.kd-admin button,.kd-admin input,.kd-admin select{font:inherit}.kd-admin button{cursor:pointer}.kd-admin button:disabled{cursor:wait;opacity:.55}.kd-admin input,.kd-admin select{border:1px solid #dfd9d2;border-radius:8px;background:#fff;padding:12px;color:#29211c}.kd-admin button:focus-visible,.kd-admin a:focus-visible,.kd-admin input:focus-visible,.kd-admin select:focus-visible{outline:3px solid #e3a17f;outline-offset:2px}.kd-admin .login{max-width:430px;margin:10vh auto;padding:35px;background:white;border:1px solid var(--line);border-radius:16px;box-shadow:0 20px 70px #291c1414}.kd-admin .login h1{font-size:30px;color:var(--dark)}.kd-admin .login input{display:block;width:100%;margin:15px 0}.kd-admin .login button,.kd-admin .primary{border:0;background:var(--orange);color:white;padding:12px 20px;border-radius:8px;font-weight:700}.kd-admin .muted{color:#746d68}.kd-admin .error{background:#fff1ed;color:#a53016;border:1px solid #e6ad99;padding:11px;border-radius:8px;margin:10px 0}.kd-admin .shell{display:flex;min-height:100vh;width:100%;max-width:none;margin:0}.kd-admin .sidebar{width:258px;background:linear-gradient(115deg,#301f13,#21170f);color:white;flex:0 0 258px;position:sticky;top:0;height:100vh;overflow:auto}.kd-admin .brand{padding:22px 19px;border-bottom:1px solid #ffffff22;display:flex;align-items:center;gap:12px}.kd-admin .brand .castle{color:#e2ba7f;font-size:43px;line-height:1}.kd-admin .brand strong{letter-spacing:1.1px;font-size:18px}.kd-admin .brand small{font-size:10px;display:block;letter-spacing:1px}.kd-admin .nav{padding:13px 11px;display:grid;gap:6px}.kd-admin .nav button{width:100%;display:flex;align-items:center;gap:15px;text-align:left;border:0;border-radius:7px;background:transparent;color:white;padding:12px 14px;font-size:15px}.kd-admin .nav button .ico{font-size:23px;min-width:29px;text-align:center}.kd-admin .nav button.active,.kd-admin .nav button:hover{background:linear-gradient(90deg,#d45528,#bf3e1c)}.kd-admin .main{min-width:0;flex:1}.kd-admin .topbar{height:70px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fff;border-bottom:1px solid var(--line);padding:0 28px}.kd-admin .search-top{width:min(450px,55%);position:relative}.kd-admin .search-top input{width:100%;padding-left:36px}.kd-admin .search-top span{position:absolute;left:12px;top:11px;font-size:19px}.kd-admin .topright{display:flex;gap:14px;align-items:center}.kd-admin .topright button{border:0;background:transparent;font-size:14px}.kd-admin .body{padding:25px 30px 50px;width:100%;margin:0}.kd-admin .heading{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:22px}.kd-admin h1{font-size:37px;line-height:1.15;font-weight:750;letter-spacing:-1px}.kd-admin .subtitle{color:#5f6880;font-size:16px;margin-top:5px}.kd-admin .segments{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}.kd-admin .segments button{background:transparent;border:0;padding:10px 18px;color:#5f6880}.kd-admin .segments button.active{color:white;background:var(--orange);border-radius:6px}.kd-admin .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:13px;margin-bottom:20px}.kd-admin .metric{background:#fff;border:1px solid #eae8e5;border-radius:11px;padding:19px 15px;display:flex;align-items:center;gap:15px;min-height:116px}.kd-admin .metric .bubble{display:grid;place-items:center;min-width:55px;height:55px;border-radius:50%;background:#e8f0fc;font-size:25px;color:#2374ab}.kd-admin .metric:nth-child(2) .bubble{background:#e4f7e9;color:#159b50}.kd-admin .metric:nth-child(3) .bubble{background:#fff1e5;color:#d35a21}.kd-admin .metric:nth-child(4) .bubble{background:#f9eede;color:#ad5417}.kd-admin .metric:nth-child(5) .bubble{background:#ffe8e8;color:#dd2b2b}.kd-admin .metric strong{display:block;font-size:23px;line-height:1.3;overflow-wrap:anywhere}.kd-admin .metric .muted{font-size:12px}.kd-admin .metric p{font-size:13px;margin-bottom:5px}.kd-admin .workspace{display:grid;grid-template-columns:minmax(0,2fr) minmax(315px,1fr);gap:14px}.kd-admin .panel{background:#fff;border:1px solid #ebe7e3;border-radius:13px;padding:18px}.kd-admin .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}.kd-admin .toolbar input{flex:1;min-width:210px}.kd-admin .tablewrap{overflow:auto}.kd-admin table{border-collapse:collapse;width:100%;min-width:690px;font-size:13px}.kd-admin th{font-size:12px;background:#f8f7f5;color:#29211f;text-align:left;padding:15px 10px}.kd-admin td{padding:13px 10px;border-bottom:1px solid #eeeae5}.kd-admin tr.selected{background:#fff0e6}.kd-admin .rowlink{border:0;background:none;text-decoration:underline;color:#7b3f20;font-weight:700}.kd-admin .tag{display:inline-block;padding:5px 9px;border-radius:9px;background:#faefe7;color:#8a4221;white-space:nowrap;font-size:12px}.kd-admin .tag.green{background:#e7f7e9;color:#206b38}.kd-admin .detail-head{display:flex;gap:12px;align-items:center}.kd-admin .avatar{width:54px;height:54px;flex:0 0 54px;border-radius:50%;background:#fce4ca;display:grid;place-items:center;color:#814010;font-size:22px;font-weight:700}.kd-admin h2{font-size:18px;margin:18px 0 10px}.kd-admin .row{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:10px 0}.kd-admin .row strong{word-break:break-word;text-align:right}.kd-admin hr{border:0;border-top:1px solid var(--line);margin:18px 0}.kd-admin .field{display:grid;gap:6px;margin:14px 0;font-size:13px}.kd-admin .field select{width:100%}.kd-admin .small{font-size:12px}.kd-admin .empty{border:1px dashed #e4d7cc;background:#fffaf5;padding:20px;border-radius:9px;color:#7a716b}.kd-admin .mobile-toggle{display:none}.kd-admin .printhead{display:none}@media(max-width:1300px){.kd-admin .workspace{grid-template-columns:1fr}}@media(max-width:850px){.kd-admin .sidebar{position:fixed;left:0;top:0;z-index:30;transform:translateX(-100%);transition:transform .2s}.kd-admin .sidebar.open{transform:none}.kd-admin .mobile-toggle{display:block}.kd-admin .topbar{padding:12px 15px;height:auto;min-height:70px;flex-wrap:wrap}.kd-admin .search-top{order:3;width:100%}.kd-admin .topright{margin-left:auto;gap:8px}.kd-admin .body{padding:20px 15px}}@media(max-width:500px){.kd-admin h1{font-size:29px}.kd-admin .metrics{grid-template-columns:1fr}.kd-admin .topright .date{display:none}}@media print{.kd-admin .sidebar,.kd-admin .topbar,.kd-admin .heading,.kd-admin .metrics,.kd-admin .list,.kd-admin .no-print{display:none!important}.kd-admin .workspace{display:block}.kd-admin .detail{border:0}.kd-admin .printhead{display:block}}
`}</style>
      {!authed ? (
        <section className="login">
          <h1>Kastélydomb Admin</h1>
          <p className="muted">Védett éttermi rendeléskezelő</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <label className="field">
              Adminjelszó
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button disabled={loading}>
              {loading ? "Belépés…" : "Belépés"}
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      ) : (
        <div className="shell">
          <aside className={"sidebar " + (sidebar ? "open" : "")}>
            <div className="brand">
              <span className="castle">♜</span>
              <div>
                <strong>KASTÉLYDOMB</strong>
                <small>KÁVÉZÓ ÉS ÉTTEREM</small>
              </div>
            </div>
            <nav className="nav">
              {navigation.map(([id, label, ico]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => selectView(id)}
                >
                  <span className="ico">{ico}</span>
                  {label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="main">
            <header className="topbar no-print">
              <button
                className="mobile-toggle"
                onClick={() => setSidebar((v) => !v)}
              >
                ☰
              </button>
              <div className="search-top">
                <span>⌕</span>
                <input
                  aria-label="Keresés az adminfelületen"
                  placeholder="Keresés az admin felületen…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="topright">
                <span className="date muted">
                  {now.toLocaleDateString("hu-HU", {
                    timeZone: "Europe/Budapest",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <button onClick={() => void load()}>↻ Frissítés</button>
                <button onClick={() => void logout()}>♙ Admin ▾ Kilépés</button>
              </div>
            </header>
            <div className="body">
              <div className="heading no-print">
                <div>
                  <h1>{title[view]}</h1>
                  <p className="subtitle">
                    {view === "drivers"
                      ? "Futárok, hozzárendelések és elszámolások kezelése"
                      : view === "home"
                        ? "Éttermének aktuális rendelési áttekintése"
                        : view === "orders"
                          ? "Vendégek megrendelései és teljesítési állapotok"
                          : view === "deliveries"
                            ? "Kiszállítandó rendelések és címek"
                            : view === "payments"
                              ? "Befizetések és fizetési állapotok"
                              : view === "receivables"
                                ? "Nyitott, még nem fizetett rendelések"
                                : view === "reports"
                                  ? "Rendelési és bevételi összesítések"
                                  : view === "customers"
                                    ? "Megrendelők és elérhetőségek"
                                    : view === "menus"
                                      ? "Heti étlap és menürendelés"
                                      : "Rendszerbeállítások"}
                  </p>
                </div>
                <div className="segments">
                  {(
                    [
                      ["daily", "Napi"],
                      ["weekly", "Heti"],
                      ["monthly", "Havi"],
                    ] as const
                  ).map(([k, v]) => (
                    <button
                      key={k}
                      className={period === k ? "active" : ""}
                      onClick={() => setPeriod(k)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {error && <div className="error no-print">{error}</div>}
              <div className="metrics no-print">
                <div className="metric">
                  <span className="bubble">🛒</span>
                  <div>
                    <p>Online megrendelések</p>
                    <strong>{scoped.length}</strong>
                    <span className="muted">kiválasztott időszak</span>
                  </div>
                </div>
                <div className="metric">
                  <span className="bubble">♧</span>
                  <div>
                    <p>Kiszállítási rendelések</p>
                    <strong>
                      {
                        scoped.filter((o) => o.fulfillment === "delivery")
                          .length
                      }
                    </strong>
                    <span className="muted">kiválasztott időszak</span>
                  </div>
                </div>
                <div className="metric">
                  <span className="bubble">▤</span>
                  <div>
                    <p>Megrendelések értéke</p>
                    <strong>{money(total)}</strong>
                    <span className="muted">lemondások nélkül</span>
                  </div>
                </div>
                <div className="metric">
                  <span className="bubble">▣</span>
                  <div>
                    <p>Teljesített rendelések</p>
                    <strong>
                      {scoped.filter((o) => o.status === "completed").length}
                    </strong>
                    <span className="muted">kiválasztott időszak</span>
                  </div>
                </div>
                <div className="metric">
                  <span className="bubble">!</span>
                  <div>
                    <p>Nyitott kintlévőség</p>
                    <strong>
                      {money(
                        unpaid.reduce(
                          (n, o) =>
                            n + Math.max(0, o.total_huf - (o.paid_huf || 0)),
                          0,
                        ),
                      )}
                    </strong>
                    <span className="muted">nem fizetett rendelések</span>
                  </div>
                </div>
              </div>
              {[
                "settings",
                "menus",
                "drivers",
                "customers",
                "reports",
                "payments",
                "receivables",
                "deliveries",
              ].includes(view) ? (
                <Operations
                  view={view}
                  orders={orders}
                  revision={revision}
                  refresh={refresh}
                />
              ) : (
                <div className="workspace">
                  <section className="panel list">
                    <div className="toolbar">
                      <input
                        aria-label="Megrendelés keresése"
                        placeholder="⌕  Keresés név, telefonszám vagy rendelési szám alapján…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <select
                        aria-label="Rendelés státusz"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">Összes állapot</option>
                        {Object.entries(status).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tablewrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Név</th>
                            <th>Telefonszám</th>
                            <th>Terület / átvétel</th>
                            <th>Rendelések</th>
                            <th>Összeg</th>
                            <th>Fizetés</th>
                            <th>Állapot</th>
                            <th>Művelet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((o) => (
                            <tr
                              key={o.id}
                              className={selected === o.id ? "selected" : ""}
                            >
                              <td>{o.order_number}</td>
                              <td>
                                <b>{nameOf(o)}</b>
                              </td>
                              <td>{o.customer_phone || "–"}</td>
                              <td>
                                {o.delivery_address || delivery[o.fulfillment]}
                              </td>
                              <td>
                                {o.items
                                  .filter((i) => i.menu !== "soup")
                                  .reduce((n, i) => n + i.quantity, 0)}{" "}
                                adag
                              </td>
                              <td>{money(o.total_huf)}</td>
                              <td>
                                <span
                                  className={
                                    "tag " +
                                    (o.payment_status === "paid" ? "green" : "")
                                  }
                                >
                                  {o.payment_status === "paid"
                                    ? "Fizetve"
                                    : "Nem fizetett"}
                                </span>
                              </td>
                              <td>
                                <span className="tag">{status[o.status]}</span>
                              </td>
                              <td>
                                <button
                                  className="rowlink"
                                  onClick={() => setSelected(o.id)}
                                >
                                  Részletek
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {shown.length === 0 && (
                      <div className="empty" style={{ marginTop: 15 }}>
                        Ebben az időszakban nincs megjeleníthető rendelés. A
                        statisztikák valós adatokat mutatnak, nem
                        mintarendeléseket.
                      </div>
                    )}
                  </section>
                  <aside className="panel detail">
                    {active ? (
                      <>
                        <div className="printhead">
                          <h1>Kastélydomb – {active.is_test !== false ? "TESZT megrendelőlap" : "megrendelőlap"}</h1>
                        </div>
                        <div className="detail-head">
                          <div className="avatar">
                            {active.customer_name
                              .split(" ")
                              .map((s) => s[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <h2 style={{ margin: 0 }}>
                              {active.customer_name}
                            </h2>
                            <p className="muted">{active.customer_phone}</p>
                          </div>
                          <button
                            className="no-print"
                            style={{
                              marginLeft: "auto",
                              background: "none",
                              border: 0,
                              fontSize: 22,
                            }}
                            onClick={() => setSelected(null)}
                            aria-label="Bezárás"
                          >
                            ×
                          </button>
                        </div>
                        <h2>Rendelés részletei</h2>
                        <p className="muted">
                          {active.order_number} ·{" "}
                          {new Date(active.created_at).toLocaleString("hu-HU", {
                            timeZone: "Europe/Budapest",
                          })}
                        </p>
                        <div className="row">
                          <span>Átvétel</span>
                          <strong>{delivery[active.fulfillment]}</strong>
                        </div>
                        {active.delivery_address && (
                          <p>{active.delivery_address}</p>
                        )}
                        {active.company_name && (
                          <p>Cég: {active.company_name}</p>
                        )}
                        {active.customer_email && (
                          <p>{active.customer_email}</p>
                        )}
                        <hr />
                        <h2>Megrendelt ételek</h2>
                        {active.items.map((it, i) => (
                          <div className="row" key={i}>
                            <div>
                              <strong>
                                {it.date} –{" "}
                                {it.menu === "soup"
                                  ? "Leves"
                                  : it.menu + " menü"}
                              </strong>
                              <div>{it.dish}</div>
                              {it.soup && (
                                <span className="muted small">
                                  Leves: {it.soup}
                                </span>
                              )}
                            </div>
                            <strong>{it.quantity} adag</strong>
                          </div>
                        ))}
                        <hr />
                        <div className="row">
                          <strong>Összeg</strong>
                          <strong>{money(active.total_huf)}</strong>
                        </div>
                        <p className="muted">
                          Fizetési mód: {payment[active.payment_method]}
                        </p>
                        {active.notes && <p>Megjegyzés: {active.notes}</p>}
                        <div className="no-print">
                          <label className="field">
                            Rendelés státusza
                            <select
                              value={active.status}
                              disabled={saving}
                              onChange={(e) =>
                                void change({ status: e.target.value })
                              }
                            >
                              {Object.entries(status).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p>
                            A rész- és teljes befizetéseket a Fizetések
                            menüpontban rögzítheti.
                          </p>
                          <button
                            className="primary"
                            onClick={() => window.print()}
                          >
                            Rendelés nyomtatása
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2>
                          {view === "drivers"
                            ? "Futár és elszámolási panel"
                            : "Rendelés részletei"}
                        </h2>
                        <div className="empty">
                          {view === "drivers"
                            ? "A futárnyilvántartáshoz még nincs rögzített futár. Futárok hozzárendelése és elszámolása külön adatmodell bevezetése után lehetséges."
                            : "Válasszon egy rendelést a táblázatból a részletek és státuszok kezeléséhez."}
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
