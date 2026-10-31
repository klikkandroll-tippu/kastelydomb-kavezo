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
for(const line of input.items){if(!line||typeof line.id!=="string"||unique.has(line.id))return fail("Hibás terméksor.",400);unique.add(line.id);const p=CHRISTMAS_PRODUCTS.find(p=>p.id===line.id);if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)return fail("Hibás mennyiség.",400);if(p.min&&line.quantity<p.min)return fail("Minden választott salátából legalább 5 adag szükséges.",400);const amount=p.price*line.quantity;total+=amount;items.push({id:p.id,name:p.name,quantity:line.quantity,unit_price_huf:p.price,line_total_huf:amount});}
const salads=["franciasalata","majonezes-burgonya","majonezes-kukorica","majonezes-tojas"];
const portions=items.filter(i=>salads.includes(i.id)).reduce((sum,i)=>sum+i.quantity,0);
if(portions>0&&portions<5)return fail("A salátákból legalább öt adag rendelhető összesen.",400);
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
let status="not_configured";
const key=process.env.RESEND_API_KEY,from=process.env.CHRISTMAS_EMAIL_FROM;
if(key&&from){
const money=(n:number)=>new Intl.NumberFormat("hu-HU",{style:"currency",currency:"HUF",maximumFractionDigits:0}).format(n);
const pickup=fulfillment==="pickup"?"Személyes átvétel":"Kiszállítás";
const pay=payment==="cash"?"Készpénz":payment==="card"?"Bankkártya":"SZÉP-kártya";
const lines=items.map(i=>i.quantity+" × "+i.name+" — "+money(i.line_total_huf)).join("\\n");
const txt="Rendelés: "+order_number+"\\nMegrendelő: "+name+"\\nTelefon: "+phone+"\\nE-mail: "+email+"\\nÁtvétel: "+pickup+", 2026. december 24.\\nCím: "+address+"\\nFizetés: "+pay+"\\n"+lines+"\\nÖsszesen: "+money(total)+"\\nMegjegyzés: "+notes+"\\nA rendelési igényt az étterem külön igazolja vissza.";
const rows=items.map(i=>"<tr><td style='padding:10px 8px;border-bottom:1px solid #eee6dc'>"+escape(String(i.quantity))+" × "+escape(i.name)+"</td><td style='padding:10px 8px;text-align:right;border-bottom:1px solid #eee6dc;white-space:nowrap'>"+escape(money(i.line_total_huf))+"</td></tr>").join("");
// A stable, opaque identifier only. No personal information is encoded in the QR.
const qrPayload="KASTELYDOMB:CHRISTMAS:2026:"+id;
const qrUrl="https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&data="+encodeURIComponent(qrPayload);
const qrImg="<img src='"+escape(qrUrl)+"' width='480' height='480' alt='Rendelés QR-kódja' style='display:block;margin:16px auto;width:100%;max-width:480px;height:auto;border:0'/>";
const html="<div style='margin:0;background:#f6f2eb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#382e26'><table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden'><tr><td style='background:#403328;color:#fff;padding:30px 24px;text-align:center'><div style='font-size:22px;font-weight:bold'>Kastélydomb Kávézó és Étterem</div><div style='margin-top:8px;color:#ead8bd'>Karácsonyi előrendelés · 2026</div></td></tr><tr><td style='padding:28px 24px'><h1 style='font-size:23px;margin:0 0 12px;color:#403328'>Rendelési igényét rögzítettük</h1><p style='line-height:1.6'>Kedves "+escape(name)+"! Köszönjük karácsonyi megrendelését. Az étterem a rendelést külön visszaigazolja.</p><p><strong>Rendelésazonosító:</strong> "+escape(order_number)+"<br/><strong>Átvétel napja:</strong> 2026. december 24.<br/><strong>Átvétel módja:</strong> "+escape(pickup)+(address?"<br/><strong>Kiszállítási cím:</strong> "+escape(address):"")+"<br/><strong>Fizetés:</strong> "+escape(pay)+"</p><h2 style='font-size:19px;color:#403328;margin:26px 0 10px'>Rendelési összesítő</h2><table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;font-size:14px'>"+rows+"<tr><td style='padding:14px 8px;font-weight:bold'>Összesen</td><td style='padding:14px 8px;text-align:right;font-size:19px;font-weight:bold;white-space:nowrap'>"+escape(money(total))+"</td></tr></table>"+(notes?"<p><strong>Megjegyzés:</strong> "+escape(notes)+"</p>":"")+"<div style='text-align:center;margin:26px 0 10px;padding:20px 12px;background:#faf7f0;border-radius:10px'><h2 style='font-size:19px;margin:0'>QR-kód az átvételhez</h2>"+qrImg+"<p style='font-size:13px;margin:8px 0'>"+escape(order_number)+"</p><p style='line-height:1.5;font-size:14px'>Őrizze meg ezt az e-mailt, és személyes átvételkor mutassa be a QR-kódot munkatársunknak.</p></div><p style='font-size:12px;line-height:1.5;color:#68594c'>Ez az e-mail a rendelési igény beérkezését igazolja, nem az étterem végleges elfogadását. A kiszállítás esetleges díja külön egyeztetés tárgya.</p></td></tr><tr><td style='background:#403328;color:#fff;padding:20px;text-align:center;font-size:13px'>Kastélydomb Kávézó és Étterem · Várpalota<br/>06 70 776 57 48 · 06 70 323 42 37 · 06 70 942 66 54</td></tr></table></div>";
const send=(to:string,subject:string,body:string)=>fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html:body}),signal:AbortSignal.timeout(8000)});
try{
const staff=await send("fenyocsaba@gmail.com",(is_test?"[TESZT] ":"")+"Karácsonyi rendelés - "+order_number,"<pre style='font:14px Arial;white-space:pre-wrap'>"+escape(txt)+"</pre>");
if(staff.ok){const guest=await send(email,(is_test?"[TESZT] ":"")+"Karácsonyi rendelési igénye - "+order_number,html);status=guest.ok?"sent":"failed";}
else status="failed";
}catch{status="failed";}
}
await db("kastelydomb_christmas_orders?id=eq."+id,{method:"PATCH",body:JSON.stringify({email_status:status})}).catch(()=>null);
return NextResponse.json({order_number,total_huf:total,is_test},{status:201,headers:{"Cache-Control":"no-store"}});
}catch{return fail("A rendelésfogadás átmenetileg nem elérhető.",503);}
}