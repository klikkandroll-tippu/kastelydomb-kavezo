import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {db,rpc,sameOrigin} from "@/lib/admin-server";
import {CHRISTMAS_PRODUCTS,type ChristmasItem} from "@/lib/christmas";
export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export async function POST(req:NextRequest){
if(!sameOrigin(req))return fail("Nem engedélyezett kérésforrás.",403);
if(process.env.CHRISTMAS_ORDERS_ENABLED!=="true")return fail("A karácsonyi online rendelés még tesztelés alatt áll.",503);
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return fail("Az adatbázis nincs beállítva.",503);
try{
const raw=await req.text();if(Buffer.byteLength(raw)>12000)return fail("Túl nagy rendelés.",413);
const input=JSON.parse(raw);if(!input||typeof input!=="object"||Array.isArray(input))return fail("Hibás kérés.",400);
const id=clean(input.request_id,40);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return fail("Hibás rendelésazonosító.",400);
const name=clean(input.name,120),phone=clean(input.phone,40),email=clean(input.email,180).toLowerCase(),address=clean(input.address,350),notes=clean(input.notes,1000);
const fulfillment=input.fulfillment,payment=input.payment;
if(!name||!/^\+?[0-9 ()-]{8,}$/.test(phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Hibás kapcsolattartási adatok.",400);
if(!["pickup","delivery"].includes(fulfillment)||!["cash","card","szep"].includes(payment)||(fulfillment==="delivery"&&!address))return fail("Hibás átvételi vagy fizetési adatok.",400);
if(input.consent!==true)return fail("Az adatkezelési tájékoztató elfogadása szükséges.",400);
if(!Array.isArray(input.items)||!input.items.length||input.items.length>CHRISTMAS_PRODUCTS.length)return fail("Üres vagy hibás kosár.",400);
const unique=new Set<string>();let total=0;const items:ChristmasItem[]=[];
for(const line of input.items){if(!line||typeof line.id!=="string"||unique.has(line.id))return fail("Hibás terméksor.",400);unique.add(line.id);const p=CHRISTMAS_PRODUCTS.find(p=>p.id===line.id);if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)return fail("Hibás mennyiség.",400);if("min" in p&&line.quantity<p.min)return fail("Hideg salátából minimum 5 adag rendelhető.",400);const amount=p.price*line.quantity;total+=amount;items.push({id:p.id,name:p.name,quantity:line.quantity,unit_price_huf:p.price,line_total_huf:amount});}
if((items.find(i=>i.id==="halaszle-belsoseg")?.quantity||0)>(items.find(i=>i.id==="halaszle")?.quantity||0))return fail("A belsőséges adagok száma nem lehet több a halászlé adagjainál.",400);
if(total>1000000)return fail("Túl nagy rendelés.",400);
const fp=sha(JSON.stringify({name,phone,email,address:fulfillment==="delivery"?address:"",notes,fulfillment,payment,items}));
const existing=await db("kastelydomb_christmas_orders?id=eq."+id+"&select=order_number,request_fingerprint,total_huf");
if(!existing.ok)return fail("A rendelési adatbázis nem elérhető.",503);
const prev=await existing.json();if(prev.length){if(prev[0].request_fingerprint!==fp)return fail("Eltérő tartalmú ismételt rendelés.",409);return NextResponse.json({order_number:prev[0].order_number,total_huf:prev[0].total_huf});}
const allowed=await rpc("kd_rate_limit",{p_key:sha("christmas:"+(req.headers.get("x-vercel-forwarded-for")?.split(",")[0]||"shared")),p_limit:12,p_seconds:900});if(!allowed)return fail("Túl sok rendelési kísérlet.",429);
const order_number="KAR-26-"+id.slice(0,8).toUpperCase();const is_test=process.env.KASTELYDOMB_MODE!=="production";
const data={id,order_number,request_fingerprint:fp,customer_name:name,customer_phone:phone,customer_email:email,delivery_address:fulfillment==="delivery"?address:null,fulfillment,payment_method:payment,notes,items,total_huf:total,is_test};
const saved=await db("kastelydomb_christmas_orders",{method:"POST",body:JSON.stringify(data)});
if(!saved.ok){const check=await db("kastelydomb_christmas_orders?id=eq."+id+"&select=order_number,request_fingerprint");const found=check.ok?await check.json():[];if(found[0]?.request_fingerprint===fp)return NextResponse.json({order_number,total_huf:total});return fail("Nem sikerült tárolni a rendelést.",503);}
let status="not_configured";const key=process.env.RESEND_API_KEY,from=process.env.CHRISTMAS_EMAIL_FROM;
if(key&&from){const txt="Rendelés: "+order_number+"\nNév: "+name+"\nTelefon: "+phone+"\nE-mail: "+email+"\nÁtvétel: "+fulfillment+"\nCím: "+address+"\nFizetés: "+payment+"\n"+items.map(i=>i.quantity+" × "+i.name+" - "+i.line_total_huf+" Ft").join("\n")+"\nÖsszesen: "+total+" Ft\nMegjegyzés: "+notes+"\nAz étterem külön visszaigazolja.";
const send=(to:string,subject:string,text:string)=>fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html:"<pre style='font:14px Arial;white-space:pre-wrap'>"+escape(text)+"</pre>"}),signal:AbortSignal.timeout(8000)});
try{const r=await send("fenyocsaba@gmail.com",(is_test?"[TESZT] ":"")+"Karácsonyi rendelés - "+order_number,txt);status=r.ok?"sent":"failed";if(r.ok)await send(email,"Karácsonyi rendelési igénye - "+order_number,"Rendelési igényét rögzítettük. Az étterem külön visszaigazolja.\n\n"+txt);}catch{status="failed";}}
await db("kastelydomb_christmas_orders?id=eq."+id,{method:"PATCH",body:JSON.stringify({email_status:status})}).catch(()=>null);
return NextResponse.json({order_number,total_huf:total,is_test},{status:201,headers:{"Cache-Control":"no-store"}});
}catch{return fail("A rendelésfogadás átmenetileg nem elérhető.",503);}
}