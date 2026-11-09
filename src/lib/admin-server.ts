import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SessionAccount } from "@/lib/admin-users";
export const COOKIE = "kd_admin_session";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function passwordValid(value: string) {
  const plain = process.env.ADMIN_PASSWORD;
  const expected =
    process.env.ADMIN_PASSWORD_SHA256 ||
    (plain && plain.length >= 16 ? hash(plain) : "");
  return (
    /^[a-f0-9]{64}$/i.test(expected) &&
    timingSafeEqual(
      Buffer.from(hash(value), "hex"),
      Buffer.from(expected, "hex"),
    )
  );
}
export function configError() {
  if (
    (!process.env.ADMIN_PASSWORD_SHA256 &&
      (!process.env.ADMIN_PASSWORD ||
        process.env.ADMIN_PASSWORD.length < 16)) ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return NextResponse.json(
      { error: "Az admin szerveroldali konfigurációja hiányos." },
      { status: 503 },
    );
  return null;
}
export async function db(path: string, options: RequestInit = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(
    process.env.SUPABASE_URL!.replace(/\/$/, "") + "/rest/v1/" + path,
    {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}),
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      },
      cache: "no-store",
    },
  );
}
export async function sessionAccount(req: NextRequest):Promise<SessionAccount|null>{
 const token=req.cookies.get(COOKIE)?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const r=await db("kastelydomb_admin_sessions?token_hash=eq."+hash(token)+
  "&expires_at=gt."+encodeURIComponent(new Date().toISOString())+
  "&select=user_id&limit=1");
 if(!r.ok)return null;
 const sessions: Array<{user_id:string|null}>=await r.json();
 if(sessions.length!==1)return null;
 if(!sessions[0].user_id)return {id:null,role:"superadmin",username:"szuperadmin",full_name:"Szuperadmin"};
 const u=await db("kastelydomb_admin_users?id=eq."+encodeURIComponent(sessions[0].user_id)+
  "&active=eq.true&select=id,username,full_name,role&limit=1");
 if(!u.ok)return null;
 const users:SessionAccount[]=await u.json();
 if(users.length!==1)return null;
 const perms=await db("kastelydomb_admin_role_permissions?role=eq."+encodeURIComponent(users[0].role)+
  "&select=pages&limit=1");
 if(!perms.ok)return null;
 const rows:Array<{pages:string[]}>=await perms.json();
 if(rows.length!==1)return null;
 return {...users[0],pages:rows[0].pages};
}
export async function authorized(req: NextRequest){return !!(await sessionAccount(req))}
function allowedForRole(account:SessionAccount,pathname:string,method:string){
 const role=account.role;
 if(role==="superadmin")return true;
 const requiredPage:Record<string,string>={
  "/api/admin/orders":"menu",
  "/api/admin/intake":"offers",
  "/api/admin/delivery-status":"delivery",
  "/api/admin/notes":"menu",
  "/api/admin/confirm":"reservations",
  "/api/admin/special-payment":"offers"
 };
 if(role!=="superadmin" && requiredPage[pathname] && !account.pages?.includes(requiredPage[pathname])){
   // Read-only courier access to holiday deliveries uses the delivery permission.
   if(!(pathname==="/api/admin/intake" && method==="GET" &&
         (account.pages||[]).some(p=>["offers","reservations","messages","delivery"].includes(p))) &&
      !(pathname==="/api/admin/orders" && method==="GET" &&
         account.pages?.includes("delivery")))
     return false;
 }
 if(pathname==="/api/admin/users")return false;
 if(pathname==="/api/admin/shell")return method==="GET";
 if(pathname==="/api/admin/notes")return role!=="courier";
 if(pathname==="/api/admin/confirm")return role!=="courier";
 if(pathname==="/api/admin/special-payment")return role!=="courier";
 if(pathname==="/api/admin/delivery-status")return true;
 if(pathname==="/api/admin/orders" || pathname==="/api/admin/intake")return method==="GET";
 return false;
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return (
    !!origin &&
    origin === req.nextUrl.origin &&
    req.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function guard(req: NextRequest) {
  const config = configError();
  if (config) return config;
  if (req.method !== "GET" && !sameOrigin(req))
    return NextResponse.json(
      { error: "Nem engedélyezett kérésforrás." },
      { status: 403 },
    );
  const account=await sessionAccount(req);
  if(!account)return NextResponse.json({error:"Kérjük, lépjen be újra."},{status:401});
  if(!allowedForRole(account,req.nextUrl.pathname,req.method))
    return NextResponse.json({error:"Nincs jogosultsága ehhez a művelethez."},{status:403});
  return null;
}
export async function body(req: NextRequest, max = 32000) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > max) throw Error("Túl nagy kérés.");
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Hibás adat.");
  return data;
}
export async function rpc(name: string, args: object) {
  const r = await db("rpc/" + name, {
    method: "POST",
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw Error(j.message || "Az adatbázis-művelet sikertelen.");
  }
  return r.json();
}
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
