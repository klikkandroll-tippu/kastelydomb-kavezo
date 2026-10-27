import { NextRequest,NextResponse } from "next/server";
import {authorized,configError,db} from "../route";
export const dynamic="force-dynamic";
const statuses=["new","confirmed","preparing","ready","completed","cancelled"];
const payments=["unpaid","pending","paid"];
export async function PATCH(req:NextRequest,context:{params:Promise<{id:string}>}){
 const config=configError();if(config)return config;
 if(!authorized(req))return NextResponse.json({error:"Hibás admin jelszó."},{status:401});
 const {id}=await context.params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Érvénytelen azonosító."},{status:400});
 const payload=await req.json().catch(()=>null);
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return NextResponse.json({error:"Érvénytelen adat."},{status:400});
 const keys=Object.keys(payload);
 if(keys.length!==1||!((keys[0]==="status"&&statuses.includes(payload.status))||(keys[0]==="payment_status"&&payments.includes(payload.payment_status))))
 return NextResponse.json({error:"Nem megengedett módosítás."},{status:400});
 const result=await db("kastelydomb_orders?id=eq."+id,{method:"PATCH",body:JSON.stringify(payload)});
 if(!result.ok)return NextResponse.json({error:"A módosítás nem menthető."},{status:502});
 const rows=await result.json();
 if(!rows.length)return NextResponse.json({error:"A rendelés nem található."},{status:404});
 return NextResponse.json({order:rows[0]},{headers:{"Cache-Control":"no-store"}});
}
