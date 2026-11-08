"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Entry = Record<string, unknown>;
type Section = "home" | "menu" | "special" | "deliveries" | "reservations" | "contacts" | "customers" | "settings";
const icons: Record<string, string> = {
 home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
 menu: '<path d="M4 3v7m3-7v7M4 7h3m-1 3v11M15 3v8m0-8c4 0 5 4 5 7v2h-5m0-9v18"/>',
 special: '<path d="M3 9h18v12H3zM2 9l3-6h14l3 6M9 9v5h6V9M7 18h2m6 0h2"/>',
 deliveries: '<path d="M4 7h11v10H4zM15 11h4l3 3v3h-7zM1 9h2M1 12h2M1 15h2"/><circle cx="8" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>',
 reservations: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h3m3 0h3"/>',
 contacts: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
 customers: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-13h3m-3 5h3"/>',
 settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
};
function Icon({ name }: { name: string }) {
  // All paths are static source-controlled SVG markup; no user input enters them.
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><g dangerouslySetInnerHTML={{ __html: icons[name] || icons.home }}/></svg>;
}
const sections: { id: Section; label: string }[] = [
  { id: "home", label: "Kezdőlap" },
  { id: "menu", label: "Napi menü megrendelések" },
  { id: "special", label: "Rendelések" },
  { id: "deliveries", label: "Kiszállítás" },
  { id: "reservations", label: "Asztalfoglalások" },
  { id: "contacts", label: "Kapcsolatfelvétel" },
  { id: "customers", label: "Ügyfelek" },
  { id: "settings", label: "Beállítások" },
];
const dateHU = (value: unknown) => typeof value === "string" && value ? new Date(value).toLocaleDateString("hu-HU") : "—";
const price = (n: unknown) => typeof n === "number" ? new Intl.NumberFormat("hu-HU").format(n) + " Ft" : "—";
const asText = (v: unknown) => typeof v === "string" || typeof v === "number" ? String(v) : "—";
const timeHU = (v: unknown) => typeof v === "string" && v ? new Date(v).toLocaleString("hu-HU",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
const statusHU = (entry:Entry) => entry.confirmed_at || entry.status==="confirmed" ? "Visszaigazolva" :
  entry.status==="cancelled" ? "Lemondva" :
  entry.status==="closed" ? "Lezárva" :
  entry.status==="in_progress" ? "Folyamatban" : "Visszaigazolásra vár";
const fulfillmentHU=(value:unknown)=>({delivery:"Kiszállítás",pickup:"Elvitel",dine_in:"Helyben fogyasztás"} as Record<string,string>)[String(value)]||asText(value);
const paymentHU=(value:unknown)=>({cash:"Készpénz",card:"Bankkártya",szep:"SZÉP-kártya",cash_on_pickup:"Készpénz az átvételkor",card_on_pickup:"Bankkártya az átvételkor",company_transfer:"Céges átutalás"} as Record<string,string>)[String(value)]||asText(value);
const fieldValue=(v:unknown)=>typeof v==="string"&&v.trim()?v:asText(v);
function Info({label,value}:{label:string,value:unknown}) {
  return <div className="kd-info"><span>{label}</span><strong>{fieldValue(value)}</strong></div>;
}
function DateItems({ items }: { items: unknown }) {
  if (!Array.isArray(items)) return <div>Nincsenek tételek.</div>;
  const byDay = new Map<string, Entry[]>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Entry;
    const key = asText(item.date ?? item.fulfillmentDate ?? "Összes tétel");
    byDay.set(key, [...(byDay.get(key) || []), item]);
  }
  return <div>{Array.from(byDay).map(([day, rows]) => <div key={day} className="kd-day"><b>{/^\d{4}-\d{2}-\d{2}$/.test(day)?dateHU(day):day}</b>{rows.map((item, i) => <div key={i}>{asText(item.quantity)} × {item.menu==="soup"?"Leves":item.menu?asText(item.menu)+" menü":asText(item.name)} – {asText(item.dish ?? item.name)}</div>)}</div>)}</div>;
}
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [confirming, setConfirming] = useState(false);
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
      // Failing one integration must not hide healthy data from the other.
      const results = await Promise.allSettled([
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/intake", { cache: "no-store" }),
      ]);
      const failures: string[] = [];
      for (let index = 0; index < results.length; index++) {
        const label = index === 0 ? "Napi menürendelések" : "Foglalások, kapcsolatfelvételek és alkalmi rendelések";
        const result = results[index];
        if (result.status === "rejected") { failures.push(label + ": hálózati hiba."); continue; }
        const response = result.value;
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          failures.push(label + ": " + (payload?.error || ("HTTP " + response.status)));
          continue;
        }
        if (index === 0) setOrders(Array.isArray(payload.orders) ? payload.orders : []);
        else {
          setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
          setReservations(Array.isArray(payload.reservations) ? payload.reservations : []);
          setChristmas(Array.isArray(payload.christmas) ? payload.christmas : []);
          if (payload.partial && Array.isArray(payload.errors)) {
            failures.push("Egyes adatforrások nem tölthetők be: " + payload.errors.join(", ") + ".");
          }
        }
      }
      if (failures.length) setError(failures.join(" "));
    } catch (e) { setError(e instanceof Error ? e.message : "Ismeretlen adatlekérési hiba."); }
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
    const search = [r.customer_name,r.customer_email,r.customer_phone,r.order_number,r.form_number,r.request_id].join(" ").toLowerCase();
    const created = String(r.reservation_date || r.created_at || "").slice(0,10);
    return (!query || search.includes(query.toLowerCase())) && (!from || created >= from) && (!to || created <= to);
  });
  async function confirmSelected(){
    if(!selected || confirming || selected.confirmed_at) return;
    const kind=section==="contacts"?"contacts":section==="reservations"?"reservations":
       section==="menu"?"menu":section==="special"?"special":null;
    if(!kind || typeof selected.id!=="string") return;
    setConfirming(true);setError("");
    try{
      const response=await fetch("/api/admin/confirm",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({kind,id:selected.id})});
      const result=await response.json();
      if(!response.ok || !result.ok) throw Error(result.error || "Nem sikerült a visszaigazolás.");
      const updated: Entry={...selected,id:selected.id,status:"confirmed",confirmed_at:result.confirmed_at};
      setSelected(updated);
      const updater=(rows:Entry[])=>rows.map(row=>row.id===updated.id?{...row,...updated}:row);
      if(kind==="contacts")setContacts(updater);
      else if(kind==="reservations")setReservations(updater);
      else if(kind==="menu")setOrders(updater);
      else setChristmas(updater);
    }catch(e){setError(e instanceof Error?e.message:"Hiba történt a visszaigazolás során.");}
    finally{setConfirming(false);}
  }
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
  const countCards: { name: string; value: number; target: Section; icon: string }[] = [
    { name: "Mai menürendelések", value: orders.filter(o=>Array.isArray(o.items) && (o.items as Entry[]).some(i=>i.date===today)).length, target: "menu", icon: "menu" },
    { name: "Mai asztalfoglalások", value: reservations.filter(r => r.reservation_date === today).length, target: "reservations", icon: "reservations" },
    { name: "Kiszállítás", value: deliveries.length, target: "deliveries", icon: "deliveries" },
    { name: "Beérkezett rendelések", value: christmas.length, target: "special", icon: "special" },
    { name: "Új megkeresések", value: contacts.filter(r => !r.confirmed_at).length, target: "contacts", icon: "contacts" },
  ];
  return <div className="kd-app">
    <style>{`
      :root{--green:#196b49;--deep:#124731;--pale:#e9f4ee;--bg:#f5f7f5;--line:#dfe7e0;--text:#1d3027;--muted:#65746a;--shadow:0 8px 25px rgba(20,56,37,.07)}
      body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.45}
      button,input{font:inherit}button{cursor:pointer} .kd-app{display:flex;min-height:100vh}
      .kd-nav{width:255px;flex-shrink:0;background:#fff;color:var(--text);padding:26px 14px;position:sticky;top:0;height:100vh;overflow-y:auto;border-right:1px solid var(--line)}
      .kd-nav h2{font-size:21px;font-weight:800;letter-spacing:.1px;margin:0 13px 4px}
      .kd-nav small{display:block;font-size:12px;color:var(--muted);margin:0 13px 30px}
      .kd-link{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;border-radius:11px;background:transparent;color:var(--text);padding:13px 14px;margin:4px 0;font-weight:650}
      .kd-link:hover{background:#f0f6f1}.kd-link.selected{background:#e6f2e9;color:var(--deep)}
      .kd-navicon{width:25px;flex-shrink:0;display:inline-flex;justify-content:center}
      .kd-navicon svg{width:20px;height:20px}
      .kd-sidefoot{margin:30px 13px;color:var(--muted);font-size:12px}
      .kd-main{flex:1;min-width:0;padding:28px 35px 55px;max-width:1750px}
      .kd-title{font-size:29px;margin:0 0 5px;letter-spacing:-.6px}
      .kd-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap}
      .kd-header{display:flex;align-items:center;gap:14px}.kd-pill{border-radius:100px;background:#eaf2ec;color:var(--deep);padding:6px 11px;font-weight:700;font-size:12px}
      .kd-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:22px;margin-bottom:18px}
      .kd-grid{display:grid;grid-template-columns:repeat(5,minmax(160px,1fr));gap:14px;margin-bottom:23px}
      .kd-stat{display:flex;flex-direction:column;justify-content:space-between;gap:13px;text-align:left;min-height:134px;background:#fff;color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:15px;padding:18px 16px}
      .kd-stat:hover{border-color:#85b39a;transform:translateY(-2px)}.kd-stat>b{font-size:13px;font-weight:800;min-height:36px}
      .kd-stat-bottom{display:flex;justify-content:space-between;align-items:center}
      .kd-stat-icon{width:44px;height:44px;display:grid;place-items:center;background:var(--pale);color:var(--green);border-radius:12px}
      .kd-stat-icon svg{width:24px;height:24px}
      .kd-stat strong{font-size:31px;color:#111;font-weight:850;letter-spacing:-1px}
      .kd-overview{padding:24px}.kd-overview h2{font-size:20px;margin:0 0 6px}
      .kd-overview p{margin:7px 0;color:#5f7065}.kd-overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
      .kd-overview-box{border:1px solid var(--line);border-radius:12px;overflow:hidden}
      .kd-overview-box h3{margin:0;background:#eaf4ec;padding:13px 15px;font-size:15px}
      .kd-overview-box p{padding:12px 15px;margin:0;color:var(--text)}
      .kd-actions{display:flex;gap:13px;flex-wrap:wrap;align-items:end;margin:14px 0 20px}
      .kd-actions input{padding:10px 11px;border:1px solid #cbd9ce;border-radius:9px;min-height:41px}
      .kd-btn{border:1px solid #cbded1;border-radius:10px;background:#fff;color:var(--deep);padding:11px 17px;font-weight:750}
      .kd-btn:hover{filter:brightness(.96)}.kd-primary{background:var(--green);color:#fff;border-color:var(--green)}
      .kd-table-wrap{overflow-x:auto}.kd-table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}
      .kd-table th,.kd-table td{padding:13px 10px;border-bottom:1px solid #ecf0ed;white-space:nowrap}
      .kd-table th{background:#f0f6f1;color:#3b5b48;font-weight:750}.kd-table tr:hover td{background:#fafcfb}
      .kd-drawer-cover{position:fixed;inset:0;background:rgba(9,29,19,.57);display:flex;justify-content:center;align-items:flex-start;padding:30px 14px;overflow:auto;z-index:50}
      .kd-drawer{width:min(910px,100%);background:#fff;border-radius:19px;box-shadow:0 20px 90px #091e1a50;padding:25px;max-height:calc(100vh - 60px);overflow:auto}
      .kd-day{background:#f8faf8;border:1px solid var(--line);padding:15px;margin:12px 0;border-radius:12px}
      .kd-details{display:grid;grid-template-columns:160px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid #ecf0ed;word-break:break-word}
      .kd-login{max-width:410px;margin:12vh auto;padding:30px}.kd-login input{padding:12px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:9px;margin:15px 0}
      .kd-modalhead{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid var(--line);padding-bottom:15px;margin-bottom:18px}
      .kd-modalhead h2{font-size:20px;margin:0;font-weight:800;letter-spacing:-.2px}
      .kd-close{border:0;background:#eaf1eb;border-radius:9px;padding:7px 12px;font-size:21px;font-weight:700;cursor:pointer}
      .kd-section{border:1px solid #e1e9e2;padding:16px;border-radius:12px;margin:13px 0}
      .kd-section h3{font-size:16px;margin:0 0 13px;font-weight:800}
      .kd-section p{margin:8px 0;white-space:pre-wrap}
      .kd-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .kd-info{background:#f8faf8;border-radius:10px;padding:10px 12px;min-height:64px;overflow-wrap:anywhere}
      .kd-info>span{color:#698073;display:block;font-size:12px;font-weight:740;margin-bottom:3px}
      .kd-info>strong{font-size:14px;font-weight:750}
      .kd-modalactions{display:flex;gap:10px;align-items:center;margin-top:17px}
      .kd-pending{color:#ab3333!important;font-weight:800}.kd-success{color:#20633d!important;font-weight:800}
      .kd-status{border-radius:99px;padding:4px 8px;white-space:nowrap;font-size:12px}
      .kd-items-title{margin-top:20px!important}.kd-muted{color:#65776c;font-size:12px}
      @media(max-width:780px){.kd-info-grid{grid-template-columns:1fr}.kd-drawer{padding:16px}}
      .kd-error{color:#a03232;margin:12px 0}
      @media(max-width:1200px){.kd-grid{grid-template-columns:repeat(3,1fr)}.kd-main{padding:23px}.kd-nav{width:215px}}
      @media(max-width:800px){.kd-app{display:block}.kd-nav{width:100%;height:auto;position:static;display:flex;flex-wrap:wrap;gap:5px;padding:12px}.kd-nav h2,.kd-nav small,.kd-sidefoot{width:100%}.kd-link{width:auto;font-size:12px;padding:9px}.kd-main{padding:16px}.kd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kd-overview-grid{grid-template-columns:1fr}}
    `}</style>    {!authed ? <div className="kd-login kd-card"><h1>Kastélydomb admin</h1><p>Védett tesztüzemi adatnézet</p><input aria-label="Adminjelszó" type="password" placeholder="Adminjelszó" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void login(); }} /><button className="kd-btn kd-primary" disabled={loading} onClick={() => void login()}>Belépés</button>{error && <p className="kd-error">{error}</p>}</div> :
    <><aside className="kd-nav"><h2>Kastélydomb</h2><small>Kávézó és Étterem · Admin</small>{sections.map(s => <button key={s.id} className={"kd-link "+(section===s.id?"selected":"")} onClick={() => { setSection(s.id); setSelected(null); setFrom(""); setTo(""); setQuery(""); }}><span className="kd-navicon"><Icon name={s.id}/></span>{s.label}</button>)}<div className="kd-sidefoot">Integrációs teszt · valós adatbázis<br/>A visszaigazolás dátummal rögzül.</div><button className="kd-link" onClick={() => void logout()}>Kijelentkezés</button></aside>
    <main className="kd-main"><div className="kd-top"><h1 className="kd-title">{sections.find(s => s.id===section)?.label}</h1><span className="kd-header"><span className="kd-pill">Integrációs teszt</span><button className="kd-btn" onClick={() => void refresh()}>Frissítés</button></span></div>
      
      {error && <p className="kd-error">{error}</p>}
      {section === "home" && <><div className="kd-grid">{countCards.map(x => <button key={x.name} className="kd-stat" onClick={() => setSection(x.target)}><b>{x.name}</b><span className="kd-stat-bottom"><span className="kd-stat-icon"><Icon name={x.icon}/></span><strong>{x.value}</strong></span></button>)}</div>
      <section className="kd-card kd-overview"><h2>Mai áttekintés</h2><p>A kártyák számai az adatbázis aktuálisan elérhető adatai alapján frissülnek.</p><div className="kd-overview-grid"><div className="kd-overview-box"><h3>Mai napi menü</h3><p>{orders.filter(o=>Array.isArray(o.items) && (o.items as Entry[]).some(i=>i.date===today)).length} érintett rendelés</p></div><div className="kd-overview-box"><h3>Mai kiszállítás</h3><p>{deliveries.length} kiszállítási feladat</p></div></div></section></>}
      {section === "settings" && <div className="kd-card"><h2>Jogosultságok</h2><p>A szuperadmin, iroda, pultos és futár személyenkénti beállítása még nem aktív. A közös adminjelszóval védett olvasási felület tesztelhető.</p></div>}
      {!["home","settings"].includes(section) && <div className="kd-card">
        <div className="kd-actions"><input placeholder="Keresés: név, azonosító" value={query} onChange={e => setQuery(e.target.value)}/><label> -tól <input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label> -ig <input type="date" value={to} onChange={e => setTo(e.target.value)}/></label>{section==="menu" && <label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/> Lejárt rendelések is</label>}</div>
        <p><strong>{filtered.length} találat</strong>{loading?" · Betöltés...":""}</p>
        <div className="kd-table-wrap"><table className="kd-table"><thead><tr><th>Azonosító</th><th>Ügyfél</th><th>Dátum</th><th>Állapot</th><th>Összeg</th><th>Művelet</th></tr></thead><tbody>{filtered.map((r,i) => <tr key={String(r.id || r.customer_email || i)}><td>{asText(r.form_number || r.order_number || r.request_id)}</td><td>{asText(r.customer_name)}</td><td>{dateHU(r.reservation_date || r.created_at)}</td><td><span className={"kd-status "+(statusHU(r)==="Visszaigazolásra vár"?"kd-pending":"kd-success")}>{section==="customers"?"Ügyfél":statusHU(r)}</span></td><td>{price(r.total_huf)}</td><td><button className="kd-btn" onClick={() => setSelected(r)}>Megnézem</button></td></tr>)}</tbody></table></div>
      </div>}
    </main></>}
    {selected !== null ? <div className="kd-drawer-cover" onClick={() => setSelected(null)}>
      <aside role="dialog" aria-modal="true" aria-label="Részletek" className="kd-drawer" onClick={e => e.stopPropagation()}>
        <div className="kd-modalhead">
          <h2>{section==="contacts"?"Megkeresés":section==="reservations"?"Asztalfoglalás":section==="menu"?"Napi menü rendelés":"Rendelés"} · {asText(selected.form_number || selected.order_number || selected.request_id)}</h2>
          <button className="kd-close" aria-label="Bezárás" onClick={() => setSelected(null)}>×</button>
        </div>
        <section className="kd-section"><h3>Ügyféladatok</h3><div className="kd-info-grid">
          <Info label="Név" value={selected.customer_name}/>
          <Info label="E-mail" value={selected.customer_email}/>
          <Info label="Telefon" value={selected.customer_phone}/>
          {selected.delivery_address ? <Info label="Szállítási cím" value={selected.delivery_address}/> : null}
        </div></section>
        {section==="reservations" ? <section className="kd-section"><h3>Foglalás adatai</h3><div className="kd-info-grid">
          <Info label="Nap" value={dateHU(selected.reservation_date)}/>
          <Info label="Érkezés" value={selected.reservation_time}/>
          <Info label="Létszám" value={asText(selected.guest_count)+" fő"}/>
          <Info label="Megjegyzés" value={selected.guest_notes}/>
        </div></section> : null}
        {section==="contacts" ? <section className="kd-section"><h3>Üzenet</h3><p>{asText(selected.message)}</p></section> : null}
        {(section==="menu" || section==="special" || section==="deliveries") ?
          <section className="kd-section"><h3>Megrendelés adatai</h3><div className="kd-info-grid">
            <Info label="Átvétel módja" value={fulfillmentHU(selected.fulfillment)}/>
            <Info label="Fizetési mód" value={paymentHU(selected.payment_method)}/>
            <Info label="Teljes összeg" value={price(selected.total_huf)}/>
            <Info label="Megjegyzés" value={selected.notes}/>
          </div><h3 className="kd-items-title">Rendelt tételek</h3><DateItems items={selected.items}/></section> : null}
        <section className="kd-section"><h3>Visszaigazolás</h3><div className="kd-info-grid">
          <div className="kd-info"><span>Állapot</span><strong className={selected.confirmed_at?"kd-success":"kd-pending"}>{statusHU(selected)}</strong></div>
          <Info label="Visszaigazolás dátuma" value={timeHU(selected.confirmed_at)}/>
        </div>
        {selected.confirmed_at || !["contacts","reservations","menu","special"].includes(section) ? null :
          <div className="kd-modalactions"><button type="button" className="kd-btn kd-primary" disabled={confirming} onClick={() => void confirmSelected()}>{confirming?"Mentés folyamatban…":"Visszaigazolva"}</button></div>}
        </section>
        <p className="kd-muted">A visszaigazolás rögzítése önmagában nem küld külön e-mailt.</p>
      </aside>
    </div> : null}
  </div>;
}
