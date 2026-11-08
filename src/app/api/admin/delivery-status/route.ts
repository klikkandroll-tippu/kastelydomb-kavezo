import {NextRequest} from "next/server";
import {guard,db,rpc,json,body} from "@/lib/admin-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^20\d\d-\d\d-\d\d$/;
export async function GET(req:NextRequest){
 const denied=await guard(req);if(denied)return denied;
 try {
  const r=await db("kastelydomb_delivery_progress?select=kind,order_id,delivery_date,delivered_at,collected_at,settled_at,collected_amount_huf,payment_method&order=updated_at.desc&limit=1000");
  if(!r.ok)return json({error:"A futárfeladatok állapotai nem tölthetők be."},503);
  return json({progress:await r.json()});
 }catch{return json({error:"A kiszállítási adatok nem érhetők el."},503)}
}
export async function POST(req:NextRequest){
 const denied=await guard(req);if(denied)return denied;
 try{
  const d=await body(req,1300);
  if(!["menu","special"].includes(d.kind)||typeof d.id!=="string"||!uuid.test(d.id)
    ||typeof d.date!=="string"||!date.test(d.date)
    ||!["delivered","collected","settled"].includes(d.action))return json({error:"Érvénytelen futárművelet."},400);
  const amount=d.action==="collected"?d.amount:null;
  const payment=d.action==="collected"?d.payment:null;
  if(d.action==="collected"&&(!Number.isSafeInteger(amount)||amount<0||!["cash","card"].includes(payment)))
    return json({error:"Adja meg a napi teljes összeget és a fizetési módot."},400);
  const result=await rpc("kd_delivery_step",{
   p_kind:d.kind,p_order:d.id,p_date:d.date,p_action:d.action,p_amount:amount,p_payment:payment
  });
  return json({ok:true,progress:result});
 }catch(e){return json({error:e instanceof Error?e.message:"A futárstátusz mentése sikertelen."},409)}
}
