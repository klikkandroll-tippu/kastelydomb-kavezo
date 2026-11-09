import {NextRequest} from "next/server";
import {guard,db,rpc,json,body,sessionAccount} from "@/lib/admin-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^20\d\d-\d\d-\d\d$/;
export async function GET(req:NextRequest){
 const denied=await guard(req);if(denied)return denied;
 try {
  const [progress,receipts,prior]=await Promise.all([
    db("kastelydomb_delivery_progress?select=kind,order_id,delivery_date,delivered_at,collected_at,settled_at,collected_amount_huf,payment_method&order=updated_at.desc&limit=1000"),
    db("kastelydomb_order_receipts?select=kind,order_id,amount_huf,method,delivery_date,collected_at&order=collected_at.desc&limit=1000"),
    db("kastelydomb_payments?select=order_id,amount_huf,method,created_at&limit=1000")
  ]);
  if(!progress.ok||!receipts.ok||!prior.ok)return json({error:"A futárfeladatok vagy a befizetések nem tölthetők be."},503);
  const account=await sessionAccount(req);
  const allProgress: Array<{kind:string;order_id:string}>=await progress.json();
  const allReceipts: Array<{kind:string;order_id:string}>=await receipts.json();
  const allPrior: Array<{order_id:string}>=await prior.json();
  if(account?.role==="courier"){
    const [orders,special]=await Promise.all([
      db("kastelydomb_orders?select=id&fulfillment=eq.delivery"),
      db("kastelydomb_christmas_orders?select=id&fulfillment=eq.delivery")
    ]);
    if(!orders.ok||!special.ok)return json({error:"A futár jogosultságai nem ellenőrizhetők."},503);
    const menuIds=new Set(((await orders.json()) as Array<{id:string}>).map(x=>x.id));
    const specialIds=new Set(((await special.json()) as Array<{id:string}>).map(x=>x.id));
    const allowed=(x:{kind:string;order_id:string})=>
      x.kind==="menu"?menuIds.has(x.order_id):x.kind==="special"&&specialIds.has(x.order_id);
    return json({
      progress:allProgress.filter(allowed),
      receipts:allReceipts.filter(allowed),
      priorPayments:allPrior.filter(x=>menuIds.has(x.order_id))
    });
  }
  return json({progress:allProgress,receipts:allReceipts,priorPayments:allPrior});
 }catch{return json({error:"A kiszállítási adatok nem érhetők el."},503)}
}
export async function POST(req:NextRequest){
 const denied=await guard(req);if(denied)return denied;
 try{
  const d=await body(req,1300);
  if(!["menu","special"].includes(d.kind)||typeof d.id!=="string"||!uuid.test(d.id)
    ||typeof d.date!=="string"||!date.test(d.date)
    ||!["delivered","paid"].includes(d.action))return json({error:"Érvénytelen futárművelet."},400);
  if(d.action==="paid"){
    if(!["cash","card"].includes(d.payment))return json({error:"Válassza ki: készpénz vagy bankkártya."},400);
    const receipt=await rpc("kd_collect_full_order",{
      p_kind:d.kind,p_order:d.id,p_date:d.date,p_method:d.payment
    });
    return json({ok:true,receipt});
  }
  const result=await rpc("kd_delivery_step",{
   p_kind:d.kind,p_order:d.id,p_date:d.date,p_action:"delivered",p_amount:null,p_payment:null
  });
  return json({ok:true,progress:result});
 }catch(e){return json({error:e instanceof Error?e.message:"A futárstátusz mentése sikertelen."},409)}
}
