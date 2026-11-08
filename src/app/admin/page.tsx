"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Entry = Record<string, unknown>;
type Section = "home" | "menu" | "special" | "deliveries" | "reservations" | "contacts" | "customers" | "settings";
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Kezdőlap", icon: "⌂" },
  { id: "menu", label: "Napi menü megrendelések", icon: "♧" },
  { id: "special", label: "Rendelések", icon: "▣" },
  { id: "deliveries", label: "Kiszállítás", icon: "▱" },
  { id: "reservations", label: "Asztalfoglalások", icon: "▦" },
  { id: "contacts", label: "Kapcsolatfelvétel", icon: "✉" },
  { id: "customers", label: "Ügyfelek", icon: "♙" },
  { id: "settings", label: "Beállítások", icon: "⚙" },
];
const dateHU = (value: unknown) => typeof value === "string" && value ? new Date(value).toLocaleDateString("hu-HU") : "—";
const price = (n: unknown) => typeof n === "number" ? new Intl.NumberFormat("hu-HU").format(n) + " Ft" : "—";
const asText = (v: unknown) => typeof v === "string" || typeof v === "number" ? String(v) : "—";
function DateItems({ items }: { items: unknown }) {
  if (!Array.isArray(items)) return <div>Nincsenek tételek.</div>;
  const byDay = new Map<string, Entry[]>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Entry;
    const key = asText(item.date ?? item.fulfillmentDate ?? "Összes tétel");
    byDay.set(key, [...(byDay.get(key) || []), item]);
  }
  return <div>{Array.from(byDay).map(([day, rows]) => <div key={day} className="kd-day"><b>{day}</b>{rows.map((item, i) => <div key={i}>{asText(item.quantity)} × {asText(item.menu ?? item.name)} – {asText(item.dish ?? item.name)}</div>)}</div>)}</div>;
}
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [orders, setOrders] = useState<Entry[]>([]);
  const [contacts, setContacts] = useState<Entry[]>([]);
  const [reservations, setReservations] = useState<Entry[]>([]);
  const [christmas, setChristmas] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [o, i] = await Promise.all([
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/intake", { cache: "no-store" }),
      ]);
      if (!o.ok || !i.ok) throw Error("Az adatlekérdezés nem sikerült.");
      const a = await o.json(); const b = await i.json();
      setOrders(a.orders || []); setContacts(b.contacts || []);
      setReservations(b.reservations || []); setChristmas(b.christmas || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Hiba"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let gone = false;
    fetch("/api/admin/session", { cache: "no-store" }).then(r => r.json()).then(d => {
      if (!gone) setAuthed(Boolean(d.authenticated));
    }).catch(() => { if (!gone) setAuthed(false); }).finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; };
  }, []);
  useEffect(() => { if (authed) void refresh(); }, [authed, refresh]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const activeMenu = useMemo(() => orders.filter(o => {
    const days = Array.isArray(o.items) ? (o.items as Entry[]).map(x => String(x.date || "")) : [];
    return days.some(d => d >= today) && o.status !== "cancelled";
  }), [orders, today]);
  const deliveries = useMemo(() => {
    const fromMenu = orders.filter(o => o.fulfillment === "delivery" && Array.isArray(o.items) && (o.items as Entry[]).some(i => i.date === today));
    const fromSpecial = christmas.filter(o => o.fulfillment === "delivery");
    return [...fromMenu, ...fromSpecial];
  }, [orders, christmas, today]);
  const allCustomers = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const r of [...orders, ...christmas, ...contacts, ...reservations]) {
      const email = String(r.customer_email || "").toLowerCase().trim();
      if (!email) continue;
      if (!map.has(email)) map.set(email, { customer_name: r.customer_name, customer_email: email, customer_phone: r.customer_phone });
    }
    return Array.from(map.values());
  }, [orders, christmas, contacts, reservations]);
  const list: Entry[] = section === "menu" ? (showArchived ? orders : activeMenu) :
    section === "special" ? christmas : section === "deliveries" ? deliveries :
    section === "reservations" ? reservations : section === "contacts" ? contacts :
    section === "customers" ? allCustomers : [];
  const filtered = list.filter(r => {
    const search = [r.customer_name,r.customer_email,r.customer_phone,r.order_number,r.request_id].join(" ").toLowerCase();
    const created = String(r.reservation_date || r.created_at || "").slice(0,10);
    return (!query || search.includes(query.toLowerCase())) && (!from || created >= from) && (!to || created <= to);
  });
  async function login() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "Sikertelen belépés");
      setPassword(""); setAuthed(true);
    } catch(e) { setError(e instanceof Error ? e.message : "Sikertelen belépés"); }
    finally { setLoading(false); }
  }
  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false); setOrders([]); setContacts([]); setReservations([]); setChristmas([]); setSelected(null);
  }
  const countCards: { name: string; value: number; target: Section }[] = [
    { name: "Aktuális napi menürendelések", value: activeMenu.length, target: "menu" },
    { name: "Mai asztalfoglalások", value: reservations.filter(r => r.reservation_date === today).length, target: "reservations" },
    { name: "Kiszállítások", value: deliveries.length, target: "deliveries" },
    { name: "Beérkezett rendelések", value: christmas.length, target: "special" },
    { name: "Kezeletlen kapcsolatfelvételek", value: contacts.filter(r => r.status === "new").length, target: "contacts" },
  ];
  return <div className="kd-app">
    <style>{`
      :root{--ink:#213b2e;--green:#1f6849;--wash:#f7f8f7;--border:#e3e9e4}
      body{margin:0;background:var(--wash);font-family:system-ui,Arial;color:var(--ink)}
      button,input{font:inherit}button{cursor:pointer}.kd-app{display:flex;min-height:100vh}
      .kd-nav{background:#fff;border-right:1px solid var(--border);padding:26px 15px;width:275px;flex-shrink:0}
      .kd-nav h2{margin:0 10px 3px;font-size:21px}.kd-nav small{display:block;margin:0 10px 27px;color:#687b70}
      .kd-link{background:transparent;color:#3a5545;border:0;border-radius:12px;display:flex;align-items:center;gap:14px;width:100%;padding:15px 14px;text-align:left;font-weight:600}
      .kd-link b{font-size:24px;width:26px;text-align:center}.kd-link.selected{background:#e9f4ec;color:#155e3a}
      .kd-main{flex:1;padding:32px;min-width:0;max-width:1650px}.kd-title{font-size:28px;margin:0 0 18px}
      .kd-top{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:18px}
      .kd-card{background:white;border:1px solid var(--border);border-radius:16px;padding:21px;box-shadow:0 8px 20px rgba(0,0,0,.02)}
      .kd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:15px}
      .kd-stat{text-align:left;background:white;color:var(--ink);border:1px solid var(--border);border-radius:15px;padding:20px}
      .kd-stat strong{font-size:26px;display:block;color:var(--green);margin-top:10px}
      .kd-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
      .kd-actions input{padding:10px;border:1px solid #d4ded6;border-radius:9px}
      .kd-btn{border:1px solid #d2e1d6;border-radius:9px;background:#fff;color:#1e613d;padding:10px 15px;font-weight:650}
      .kd-primary{background:#1c7049;color:#fff;border-color:#1c7049}
      .kd-table-wrap{overflow-x:auto}.kd-table{width:100%;border-collapse:collapse;text-align:left}
      .kd-table th,.kd-table td{padding:14px 12px;border-bottom:1px solid #ebefeb;white-space:nowrap}
      .kd-table th{background:#f8faf8;color:#526b5b;font-size:13px}
      .kd-drawer-cover{position:fixed;inset:0;background:#1118;display:flex;justify-content:flex-end;z-index:50}
      .kd-drawer{width:min(620px,100vw);background:#fff;height:100vh;overflow:auto;padding:25px;box-shadow:-8px 0 35px #0002}
      .kd-day{background:#f8faf8;border:1px solid var(--border);padding:15px;margin:10px 0;border-radius:12px}
      .kd-details{display:grid;grid-template-columns:140px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid #eee;word-break:break-word}
      .kd-login{max-width:410px;margin:12vh auto;padding:30px}.kd-login input{padding:12px;width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:9px;margin:15px 0}
      .kd-error{color:#a03232;margin:12px 0}
      @media(max-width:850px){.kd-app{display:block}.kd-nav{width:100%;padding:12px;display:flex;flex-wrap:wrap;gap:5px}.kd-nav h2,.kd-nav small{width:100%}.kd-link{width:auto;font-size:12px;padding:9px}.kd-link b{font-size:17px}.kd-main{padding:16px}}
    `}</style>
    {!authed ? <div className="kd-login kd-card"><h1>Kastélydomb admin</h1><p>Védett tesztüzemi adatnézet</p><input aria-label="Adminjelszó" type="password" placeholder="Adminjelszó" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void login(); }} /><button className="kd-btn kd-primary" disabled={loading} onClick={() => void login()}>Belépés</button>{error && <p className="kd-error">{error}</p>}</div> :
    <><aside className="kd-nav"><h2>Kastélydomb</h2><small>Adminisztráció · integrációs teszt</small>{sections.map(s => <button key={s.id} className={"kd-link "+(section===s.id?"selected":"")} onClick={() => { setSection(s.id); setSelected(null); setFrom(""); setTo(""); setQuery(""); }}><b aria-hidden="true">{s.icon}</b>{s.label}</button>)}<button className="kd-link" onClick={() => void logout()}>Kijelentkezés</button></aside>
    <main className="kd-main"><div className="kd-top"><h1 className="kd-title">{sections.find(s => s.id===section)?.label}</h1><button className="kd-btn" onClick={() => void refresh()}>Frissítés</button></div>
      <p>Integrációs ellenőrző nézet – valódi adatbázis, egyelőre csak olvasás. Tesztadatok elkülönítve.</p>
      {error && <p className="kd-error">{error}</p>}
      {section === "home" && <div className="kd-grid">{countCards.map(x => <button key={x.name} className="kd-stat" onClick={() => setSection(x.target)}>{x.name}<strong>{x.value}</strong></button>)}</div>}
      {section === "settings" && <div className="kd-card"><h2>Jogosultságok</h2><p>A szuperadmin, iroda, pultos és futár személyenkénti beállítása még nem aktív. A közös adminjelszóval védett olvasási felület tesztelhető.</p></div>}
      {!["home","settings"].includes(section) && <div className="kd-card">
        <div className="kd-actions"><input placeholder="Keresés: név, azonosító" value={query} onChange={e => setQuery(e.target.value)}/><label> -tól <input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label> -ig <input type="date" value={to} onChange={e => setTo(e.target.value)}/></label>{section==="menu" && <label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/> Lejárt rendelések is</label>}</div>
        <p><strong>{filtered.length} találat</strong>{loading?" · Betöltés...":""}</p>
        <div className="kd-table-wrap"><table className="kd-table"><thead><tr><th>Azonosító</th><th>Ügyfél</th><th>Dátum</th><th>Állapot</th><th>Összeg</th><th>Művelet</th></tr></thead><tbody>{filtered.map((r,i) => <tr key={String(r.id || r.customer_email || i)}><td>{asText(r.order_number || r.request_id)}</td><td>{asText(r.customer_name)}</td><td>{dateHU(r.reservation_date || r.created_at)}</td><td>{asText(r.status)}</td><td>{price(r.total_huf)}</td><td><button className="kd-btn" onClick={() => setSelected(r)}>Megnézem</button></td></tr>)}</tbody></table></div>
      </div>}
    </main></>}
    {selected && <div className="kd-drawer-cover" onClick={() => setSelected(null)}><aside role="dialog" aria-modal="true" aria-label="Részletek" className="kd-drawer" onClick={e => e.stopPropagation()}><div className="kd-top"><h2>Részletek</h2><button className="kd-btn" onClick={() => setSelected(null)}>Bezárás</button></div>
      <h3>Ügyféladatok</h3>{(["customer_name","customer_email","customer_phone","delivery_address"] as const).map(k => <div className="kd-details" key={k}><b>{k}</b><span>{asText(selected[k])}</span></div>)}
      <h3>Megrendelés / kérés</h3>{(["order_number","request_id","reservation_date","reservation_time","guest_count","fulfillment","payment_method","total_huf","status","confirmed_at","message","guest_notes","notes","internal_notes"] as const).filter(k=>selected[k]!==undefined).map(k=><div className="kd-details" key={k}><b>{k}</b><span>{asText(selected[k])}</span></div>)}
      <h3>Napi / termékenkénti tételek</h3><DateItems items={selected.items}/><p>Ebben a tesztkiadásban módosítás és pénzügyi lezárás nem engedélyezett.</p>
    </aside></div>}
  </div>;
}
