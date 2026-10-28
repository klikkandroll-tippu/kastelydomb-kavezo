import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/admin-server";
import {randomUUID} from "node:crypto";
export const dynamic="force-dynamic";
type MenuKey="A"|"B"|"C";
const validFulfillments=["pickup","delivery","dine_in"] as const;
const validPayments=["cash_on_pickup","card_on_pickup","company_transfer"] as const;
type Day={date:string;soup:string;A:string|null;B:string|null;C:string|null;holiday?:boolean};
const MENU:Day[]=[
{date:"2026-10-26",soup:"Fokhagyma-krémleves",A:"Tarhonyás hús",B:"Mexikói csirkeragu, párolt rizs",C:"Sajttal-sonkával töltött borda, petrezselymes burgonya"},
{date:"2026-10-27",soup:"Karalábéleves",A:"Pikáns csirkeszárnyak, párolt rizs",B:"Csikós tokány, orsótészta",C:"Palermói szelet, párolt rizs"},
{date:"2026-10-28",soup:"Húsleves kiskocka tésztával",A:"Sárgaborsófőzelék, feltét",B:"Paradicsomos káposzta, feltét",C:"Rántott szelet, hasábburgonya"},
{date:"2026-10-29",soup:"Tojásleves",A:"Disznótoros, hagymás tört burgonya",B:"Zöldborsós szelet, párolt rizs",C:"Kijevi sertésborda, párolt rizs"},
{date:"2026-10-30",soup:"Legényfogó leves",A:"Mákos/diós tészta",B:"Túrógombóc édes tejföllel",C:"Sertésflekken, pirított burgonya"}
];
function hungaryNow(){return new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Budapest"}));}
function cutoffFor(day:string,fulfillment:string){const d=new Date(day+"T00:00:00"); const today=hungaryNow();const at=new Date(d);at.setHours(fulfillment==="delivery"?9:14,fulfillment==="delivery"?0:30,0,0);return today<at;}
const text=(v:unknown,max=200)=>typeof v==="string"?v.trim().slice(0,max):"";
export async function POST(req:NextRequest){
 if(process.env.ORDER_INTAKE_ENABLED!=="true")return NextResponse.json({error:"Az online rendelésfogadás jelenleg még nem aktív."},{status:503});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"A rendelésfogadás még nincs beállítva."},{status:503});
 const size=Number(req.headers.get("content-length")||0);if(size>16000)return NextResponse.json({error:"Túl nagy rendelés."},{status:413});
 const input=await req.json().catch(()=>null);if(!input||typeof input!=="object"||Array.isArray(input))return NextResponse.json({error:"Hibás kérés."},{status:400});
 const customer_name=text(input.customer_name,120),customer_phone=text(input.customer_phone,40),customer_email=text(input.customer_email,200);
 const company_name=text(input.company_name,180),delivery_address=text(input.delivery_address,350),notes=text(input.notes,1000);
 const customer_type=input.customer_type==="company"?"company":"private", fulfillment=input.fulfillment,payment_method=input.payment_method;
 if(!customer_name||!/^\+?[0-9 ()-]{8,}$/.test(customer_phone)||customer_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email))return NextResponse.json({error:"Hiányzó vagy hibás kapcsolattartási adatok."},{status:400});
 if(!validFulfillments.includes(fulfillment)||!validPayments.includes(payment_method))return NextResponse.json({error:"Nem elérhető átvétel vagy fizetés."},{status:400});
 if(payment_method==="company_transfer"&&(customer_type!=="company"||!company_name||!customer_email))return NextResponse.json({error:"Átutalás csak teljes céges adatokkal lehetséges."},{status:400});
 if(fulfillment==="delivery"&&!delivery_address)return NextResponse.json({error:"A kiszállítási cím hiányzik."},{status:400});
 if(input.plan!=="yes"&&input.plan!=="no")return NextResponse.json({error:"Érvénytelen rendeléstípus."},{status:400});
 if(!Array.isArray(input.days)||input.days.length>5)return NextResponse.json({error:"Érvénytelen napok."},{status:400});
 let total=0,days=0;const items:Array<{date:string;menu:string;dish:string;quantity:number;soup?:string}>=[];
 const seen=new Set<string>();
 for(const d of input.days){
  if(typeof d!=="object"||!d||seen.has(d.date))return NextResponse.json({error:"Duplikált vagy hibás nap."},{status:400});
  seen.add(d.date);const menu=MENU.find(x=>x.date===d.date);if(!menu)return NextResponse.json({error:"Az adott nap menüje nem rendelhető."},{status:400});
  const qty=(k:string)=>d[k]===undefined?0:d[k];
  for(const k of ["A","B","C","soup"]){if(!Number.isInteger(qty(k))||qty(k)<0||qty(k)>5)return NextResponse.json({error:"Érvénytelen adagszám."},{status:400})}
  const a=qty("A"),b=qty("B"),c=qty("C"),s=qty("soup"),n=a+b+c;
  if(!n){if(s)return NextResponse.json({error:"Csak leves nem rendelhető."},{status:400});continue}
  if(!cutoffFor(d.date,fulfillment))return NextResponse.json({error:"A rendelési határidő lejárt."},{status:400});
  if(s<c||s>n)return NextResponse.json({error:"Levesmennyiség nem megfelelő."},{status:400});
  if(input.plan==="no"&&(a||b||s!==c))return NextResponse.json({error:"Előfizetés nélkül csak C menü rendelhető levessel."},{status:400});
  if(a&&!menu.A||b&&!menu.B||c&&!menu.C)return NextResponse.json({error:"Nem rendelhető fogás."},{status:400});
  total+=input.plan==="yes"?(a+b)*1700+c*2300+(s-c)*200:c*2800;days++;
  for(const k of ["A","B","C"] as MenuKey[]){const quantity=qty(k);if(quantity)items.push({date:d.date,menu:k,dish:menu[k]!,quantity,soup:s?menu.soup:undefined})}
 }
 if(!days||(input.plan==="yes"&&days<2))return NextResponse.json({error:"Válasszon megfelelő számú rendelési napot."},{status:400});
 if(total>250000)return NextResponse.json({error:"Túl nagy rendelés."},{status:400});
 const id=randomUUID(),order_number="MENU-"+new Date().toISOString().slice(2,10).replace(/-/g,"")+"-"+id.slice(0,8).toUpperCase();
 const data={id,order_number,customer_name,customer_phone,customer_email:customer_email||null,customer_type,company_name:company_name||null,fulfillment,delivery_address:delivery_address||null,payment_method,payment_status:"unpaid",status:"new",total_huf:total,items,notes:notes||null};
 const response=await db("kastelydomb_orders",{method:"POST",body:JSON.stringify(data)});
 if(!response.ok)return NextResponse.json({error:"A rendelést nem sikerült tárolni. Kérjük, próbálja újra."},{status:502});
 return NextResponse.json({order_number,total_huf:total},{status:201,headers:{"Cache-Control":"no-store"}});
}
