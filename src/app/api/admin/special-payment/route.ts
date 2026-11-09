import {NextRequest} from "next/server";
import {guard,rpc,json,body} from "@/lib/admin-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 const denied=await guard(req);if(denied)return denied;
 try{
  const data=await body(req,1300);
  if(typeof data.id!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.id)
    ||!["cash","card"].includes(data.method))return json({error:"Adjon meg érvényes rendelést és fizetési módot."},400);
  const receipt=await rpc("kd_pay_special_order",{p_order:data.id,p_method:data.method});
  return json({ok:true,receipt});
 }catch(e){
  return json({error:e instanceof Error?e.message:"Nem sikerült a fizetés rögzítése."},409);
 }
}