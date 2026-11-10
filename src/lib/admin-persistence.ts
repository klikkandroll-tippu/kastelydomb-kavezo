// Server-only, opt-in DB writes. Zapier notification remains mandatory.
export type AdminTable = "kastelydomb_contacts" | "kastelydomb_reservations" | "kastelydomb_orders" | "kastelydomb_christmas_orders";
export function adminSyncEnabled() { return process.env.ADMIN_DB_SYNC_ENABLED === "true"; }
function connection() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("Admin adatmentési konfiguráció hiányzik.");
  return {base:url.replace(/\/$/,"")+"/rest/v1/", headers:{
    apikey:key, ...(key.startsWith("eyJ") ? {Authorization:"Bearer "+key} : {}),
    "Content-Type":"application/json"
  }};
}
// Database uniqueness constraints on request_id / request_fingerprint guarantee
// repeat POSTs cannot add duplicate rows; request ID must remain stable on retry.
export async function persistAdminRow(table:AdminTable, row:Record<string,unknown>) {
  if (!adminSyncEnabled()) return false;
  const {base,headers}=connection();
  const conflict = table==="kastelydomb_contacts" || table==="kastelydomb_reservations"
      ? "request_id" : "request_fingerprint";
  if(!row[conflict]) throw Error("Hiányzó ismétlésvédelmi azonosító.");
  const response=await fetch(base+table+"?on_conflict="+conflict,{
    method:"POST",headers:{...headers,Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify(row),signal:AbortSignal.timeout(12000),cache:"no-store"
  });
  if(!response.ok) throw Error("Admin adatmentés sikertelen ("+response.status+")");
  return true;
}
async function patchOutbox(id:string, state:"sent"|"uncertain", error?:string) {
  const {base,headers}=connection();
  const r=await fetch(base+"kastelydomb_notification_outbox?request_id=eq."+encodeURIComponent(id),{
    method:"PATCH",headers:{...headers,Prefer:"return=minimal"},
    body:JSON.stringify({state,sent_at:state==="sent"?new Date().toISOString():null,last_error:error?.slice(0,180)||null}),
    signal:AbortSignal.timeout(8000),cache:"no-store"
  });
  if(!r.ok) throw Error("Értesítési státusz mentése sikertelen.");
}
export async function sendZapierOnce(source:"menu"|"christmas"|"contact"|"reservation",id:string,webhook:string,payload:unknown,timeoutMs=12000) {
  // Legacy mailing stays unchanged when database sync is off.
  if(!adminSyncEnabled()){
    const r=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)});
    if(!r.ok) throw Error("Zapier HTTP "+r.status);
    return "sent";
  }
  const {base,headers}=connection();
  const claim=await fetch(base+"rpc/kd_claim_notification",{
    method:"POST",headers,body:JSON.stringify({p_request_id:id,p_source:source}),
    signal:AbortSignal.timeout(10000),cache:"no-store"
  });
  if(!claim.ok) throw Error("Értesítési zár nem hozható létre.");
  const action:unknown=await claim.json();
  if(action==="sent") return "sent";
  if(action!=="send") throw Error("Az értesítés állapota ellenőrzést igényel. Új e-mailt nem indítottunk.");
  try{
    const sent=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)});
    if(!sent.ok) throw Error("Zapier HTTP "+sent.status);
  }catch(e){
    // The Zapier call may have been received despite a timeout: do NOT
    // automatically retry and risk duplicate emails.
    await patchOutbox(id,"uncertain",e instanceof Error?e.message:"Unknown delivery result");
    throw Error("Az e-mail-értesítés eredménye ellenőrzést igényel.");
  }
  await patchOutbox(id,"sent");
  return "sent";
}
