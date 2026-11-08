import {NextRequest,NextResponse} from "next/server";
import {guard} from "@/lib/admin-server";
import {approvedAdminHtml} from "@/lib/approved-admin-html";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
  const denied=await guard(req);
  if(denied)return denied;
  return new NextResponse(approvedAdminHtml,{status:200,headers:{
    "Content-Type":"text/html; charset=utf-8",
    "Cache-Control":"private, no-store, max-age=0",
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"SAMEORIGIN",
    "Content-Security-Policy":"frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
  }});
}
