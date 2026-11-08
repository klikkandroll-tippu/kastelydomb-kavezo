import {NextRequest} from "next/server";
import {guard,db,json,body} from "@/lib/admin-server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const denied=await guard(req);if(denied)return denied;
  const data=await body(req,3500);
  const kind=data.kind,id=data.id,notes=data.notes;
  if(!["menu","special"].includes(kind)||typeof id!=="string"||!/^[a-f0-9-]{36}$/i.test(id)
    ||typeof notes!=="string"||notes.length>2000)return json({error:"Érvénytelen adat."},400);
  const table=kind==="menu"?"kastelydomb_orders":"kastelydomb_christmas_orders";
  const response=await db(table+"?id=eq."+encodeURIComponent(id)+"&select=id",{
   method:"PATCH",body:JSON.stringify({notes}),headers:{Prefer:"return=representation"}
  });
  if(!response.ok)return json({error:"A megjegyzést nem sikerült menteni."},503);
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length!==1)return json({error:"A rendelés nem található."},404);
  return json({ok:true});
 }catch{return json({error:"A megjegyzés mentése sikertelen."},503)}
}
