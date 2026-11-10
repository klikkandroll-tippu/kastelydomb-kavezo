import {NextRequest,NextResponse} from "next/server";
import {COOKIE,db,hash} from "@/lib/admin-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";

// Direct logout URL for shared computers, even when old admin UI has no logout.
export async function GET(req:NextRequest){
 const token=req.cookies.get(COOKIE)?.value;
 if(token){
  try{
   const deleted=await db("kastelydomb_admin_sessions?token_hash=eq."+hash(token),{method:"DELETE"});
   if(!deleted.ok)throw Error("session revoke failed");
  }catch{
   return new NextResponse(
    "A kijelentkezés nem sikerült. Próbálja újra, vagy nyissa meg az admin belépési oldalt inkognitóablakban.",
    {status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}}
   );
  }
 }
 const target=new URL("/admin",req.url);
 const response=NextResponse.redirect(target,303);
 response.cookies.set(COOKIE,"",{
  httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0
 });
 response.headers.set("Cache-Control","no-store");
 return response;
}
