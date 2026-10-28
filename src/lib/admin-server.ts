import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
export function authorized(req:NextRequest) {
 const expected=process.env.ADMIN_PASSWORD_SHA256;
 if(!expected || !/^[a-f0-9]{64}$/i.test(expected)) return false;
 const value=req.headers.get("x-admin-password")||"";
 const digest=createHash("sha256").update(value).digest();
 return timingSafeEqual(digest,Buffer.from(expected,"hex"));
}
export function configError(){
 if(!process.env.ADMIN_PASSWORD_SHA256||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 return NextResponse.json({error:"Az admin még nincs konfigurálva. Szükséges: ADMIN_PASSWORD_SHA256, SUPABASE_URL és SUPABASE_SERVICE_ROLE_KEY."},{status:503});
 return null;
}
export async function db(path:string,options:RequestInit={}){
 const url=process.env.SUPABASE_URL!.replace(/\/$/,"")+"/rest/v1/"+path;
 return fetch(url,{...options,headers:{"apikey":process.env.SUPABASE_SERVICE_ROLE_KEY!,...(process.env.SUPABASE_SERVICE_ROLE_KEY!.startsWith("eyJ")?{"Authorization":"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY!}:{}),"Content-Type":"application/json","Prefer":"return=representation",...(options.headers||{})},cache:"no-store"});
}
