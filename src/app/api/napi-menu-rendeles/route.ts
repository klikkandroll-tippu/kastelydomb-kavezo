import {NextRequest,NextResponse} from "next/server";
import {emailRecipients} from "@/lib/email-routing";
import {persistAdminRow,sendZapierOnce} from "@/lib/admin-persistence";
import {randomUUID} from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const dishes=[
["2026-11-02","Vöröslencseleves","Karfiolos-sajtos sertéstokány, párolt rizs","Hagymás csirkemáj, burgonya","Borzas szelet, párolt rizs"],
["2026-11-03","Zöldségleves","Bolognai spagetti, reszelt sajt","Vagdalt szelet, párolt rizs","Velővel töltött borda, pirított kockaburgonya"],
["2026-11-04","Csontleves daragaluskával","Főtt tojás, spenót, tört burgonya","Finomfőzelék, feltét","Natúr szelet pórémártással, párolt rizs"],
["2026-11-05","Árpagyöngyleves","Temesvári szelet, párolt rizs","Töltött csirkecomb, petrezselymes burgonya","Kassai töltött borda (sonka, tojás, zöldborsó), petrezselymes burgonya"],
["2026-11-06","Bakonyi betyárleves","Morzsás nudli","Káposztás tészta","Pankómorzsában sült csirkemellcsíkok, párolt rizs"],
["2026-11-09","Brokkoli krémleves","Sertés rizottó, reszelt sajt","Fokhagymás aprópecsenye, burgonya","Menyecskeláb rántva, pirított burgonya"],
["2026-11-10","Reszelt tésztaleves","Rakott burgonya","Eszterházi tokány, orsótészta","Csáki töltött borda, párolt rizs"],
["2026-11-11","Húsleves eperlevéllel","Székelykáposzta","Zöldborsófőzelék, feltét","Parajos penne grillezett csirkefalatokkal"],
["2026-11-12","Magyaros burgonyaleves","Rántott szelet, kukoricás rizs","Sertéssült, gyümölcsmártás, pirított dara","Zöldséges töltött borda, petrezselymes rizs"],
["2026-11-13","Lencsegulyás","Túrós tészta","Aranygaluska vaníliaöntettel","Sertésszelet parasztosan, tört burgonya"],
["2026-11-16","Karfiol leves","Pásztor tarhonya","Mustáros sertésragu, Párolt rizs","Csirkemájjal töltött borda, Párolt rizs"],
["2026-11-17","Gyöngybab leves","Édes-savanyú csirkecsíkok, Párolt rizs","Sertéspaprikás galuskával","Cigánypecsenye, Tepsis burgonya"],
["2026-11-18","Csontleves májgaluskával","Zöldbabfőzelék, feltét","Paradicsomos húsgombóc, Tört burgonya","Holstein szelet, Petrezselymes rizs"],
["2026-11-19","Gomba leves","Sertéssült, Burgonya, Párolt káposzta","Búboshús, Párolt rizs","Csülök Pékné módra"],
["2026-11-20","Csirke becsinált leves","Almás-fahéjas gombóc","Sajtos-tejfölös tészta","Lyoni szelet, Párolt rizs"],
];
// Single menu catalog for both order validation and the public weekly menu.
export async function GET(){
  const now=current();
  const days=dishes.map(([date,soup,A,B,C])=>({date,soup,A,B,C,archiveOn:archiveFriday(date)}))
    .filter(({archiveOn})=>now.date<archiveOn || (now.date===archiveOn && now.minutes<900));
  return NextResponse.json({days},{headers:{"Cache-Control":"no-store"}});
}
function archiveFriday(date:string){
  const friday=new Date(date+"T12:00:00Z");
  const weekday=(friday.getUTCDay()+6)%7;
  friday.setUTCDate(friday.getUTCDate()+4-weekday);
  return friday.toISOString().slice(0,10);
}
const clean=(x:unknown,max=500)=>typeof x==="string"?x.trim().slice(0,max):"";
const esc=(x:unknown)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const bad=(error:string,status=400)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const current=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());const v=(s:string)=>p.find(x=>x.type===s)!.value;return {date:v("year")+"-"+v("month")+"-"+v("day"),minutes:Number(v("hour"))*60+Number(v("minute"))}};
const ft=(n:number)=>new Intl.NumberFormat("hu-HU").format(n)+" Ft";
export async function POST(req:NextRequest){
  const origin=req.headers.get("origin");if(origin && origin!==req.nextUrl.origin)return bad("Nem engedélyezett kérés.",403);
  if(process.env.VERCEL_ENV!=="preview" && process.env.ORDER_INTAKE_ENABLED!=="true")return bad("A megrendelés ezen a címen nem elérhető.",503);
  const hook=process.env.MENU_ZAPIER_WEBHOOK_URL;
  if(process.env.MENU_ZAPIER_ENABLED!=="true" || !hook?.startsWith("https://hooks.zapier.com/hooks/catch/"))return bad("A menürendelés értesítése még nincs beállítva.",503);
  let d:any;try{const raw=await req.text();if(Buffer.byteLength(raw,"utf8")>16000)return bad("Túl nagy rendelés.",413);d=JSON.parse(raw)}catch{return bad("Érvénytelen rendelési adatok.")}
  if(!d||typeof d!=="object"||Array.isArray(d))return bad("Hibás rendelési adatok.");
  const name=clean(d.customer_name,120),phone=clean(d.customer_phone,50),email=clean(d.customer_email,180);
  if(!name||!/^\+?[0-9 ()-]{8,}$/.test(phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return bad("Adjon meg érvényes nevet, telefonszámot és e-mail-címet.");
  if(d.privacy!==true)return bad("Az adatkezelési tájékoztató elfogadása szükséges.");
  if(!["yes","no"].includes(d.plan)||!["pickup","takeaway","delivery"].includes(d.fulfillment)||!["cod-cash","cod-card","transfer"].includes(d.payment))return bad("Érvénytelen rendelési, átvételi vagy fizetési mód.");
  const isCompany=d.customer_type==="company",companyName=clean(d.company_name,180),companyAddress=clean(d.company_address,350),tax=clean(d.tax_number,30);
  if(isCompany&&(!companyName||!companyAddress||!/^\d{8}-\d-\d{2}$/.test(tax)))return bad("A céges számlázási adatok hiányosak.");
  if(d.payment==="transfer"&&!isCompany)return bad("Banki átutalást csak céges megrendelő választhat.");
  const town=clean(d.town,70),street=clean(d.street,140),house=clean(d.house,35),unit=clean(d.unit,60),intercom=clean(d.intercom,60);
  if(d.fulfillment==="delivery"&&(!["Várpalota","Inota","Pétfürdő"].includes(town)||!street||!house))return bad("Adja meg a kiszállítás pontos címét.");
  const address=d.fulfillment==="delivery"?[town,street+" "+house,unit,intercom?"Kaputelefon: "+intercom:""].filter(Boolean).join(", "):"";
  if(!Array.isArray(d.days)||!d.days.length||d.days.length>5)return bad("Legalább egy napra válasszon menüt.");
  const now=current(),used=new Set<string>(),items:Array<{date:string;menu:string;dish:string;quantity:number}>=[];let total=0,orderedDays=0;
  for(const day of d.days){
    if(!day||typeof day!=="object"||used.has(day.date))return bad("Duplikált vagy hibás rendelési nap.");
    used.add(day.date);
    const row=dishes.find(x=>x[0]===day.date);if(!row)return bad("A kiválasztott hét rendelési adatai nem érvényesek.");
    const vals=["A","B","C","soup"].map(k=>day[k]??0);
    if(vals.some(n=>!Number.isInteger(n)||n<0||n>10))return bad("Érvénytelen adagszám.");
    const [a,b,c,s]=vals,n=a+b+c;if(!n)return bad("Csak leves nem rendelhető.");
    if(s<c||s>n)return bad("A levesek száma nem megfelelő.");
    if(d.plan==="no"&&(a||b||s!==c))return bad("Előfizetés nélkül kizárólag C menü rendelhető levessel.");
    if(day.date<now.date || (day.date===now.date && now.minutes >= (d.fulfillment==="delivery"?540:870)))return bad("Az egyik kiválasztott nap rendelési határideje lejárt.");
    if(d.plan==="yes"&&(a||b)){
      const date=new Date(day.date+"T12:00:00Z");const weekday=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()+2-weekday);
      const cutoff=date.toISOString().slice(0,10);
      if(now.date>cutoff || now.date===cutoff&&now.minutes>=870)return bad("Az A/B menük előrendelési határideje lejárt.");
    }
    orderedDays++;total+=d.plan==="yes"?(a+b)*1700+c*2300+(s-c)*200:c*2800;
    [["A",a,2],["B",b,3],["C",c,4],["soup",s,1]].forEach(([menu,q,index])=>{if(Number(q)>0)items.push({date:day.date,menu:String(menu),dish:row[Number(index)],quantity:Number(q)})});
  }
  if(d.plan==="yes"&&orderedDays<2)return bad("Előfizetéssel legalább két külön napra kell rendelni.");
  if(total>500000)return bad("Túl nagy rendelés.");
  const id=typeof d.request_id==="string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(d.request_id)?d.request_id:randomUUID(),orderNumber="MENU-"+now.date.slice(2).replace(/-/g,"")+"-"+id.slice(0,8).toUpperCase();
  const fulfillmentHu=d.fulfillment==="delivery"?"Kiszállítás":d.fulfillment==="takeaway"?"Elvitel":"Helyben fogyasztás";
  const paymentHu=d.payment==="transfer"?"Céges banki átutalás":d.payment==="cod-card"?"Bankkártya az átvételkor":"Készpénz az átvételkor";
  const recipients=emailRecipients(email, process.env.VERCEL_ENV === "preview" || process.env.KASTELYDOMB_MODE !== "production");
  const qrValue="KASTELYDOMB:MENU:"+id,qrUrl="https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&data="+encodeURIComponent(qrValue);
  // Keep one visually distinct block per day, with soup first and selected mains after it.
  // Render both guest and restaurant notifications from this identical grouped markup.
  const dayLabels=["Vasárnap","Hétfő","Kedd","Szerda","Csütörtök","Péntek","Szombat"];
  const rows=[...new Set(items.map(item=>item.date))].sort().map(date=>{
    const dayItems=items.filter(item=>item.date===date).sort((a,b)=>(a.menu==="soup"?0:1)-(b.menu==="soup"?0:1));
    const weekday=dayLabels[new Date(date+"T12:00:00Z").getUTCDay()];
    const dishLines=dayItems.map(item=>"<div style='padding:5px 0;line-height:1.5'><strong>"+esc(item.menu==="soup"?"Leves":item.menu+" menü")+":</strong> "+esc(item.dish)+" <span style='white-space:nowrap'>("+item.quantity+" adag)</span></div>").join("");
    return "<div style='border:1px solid #e8dccb;border-radius:10px;margin:12px 0;overflow:hidden'><div style='background:#f3ede2;padding:11px 14px;font-weight:bold'>"+esc(date)+" – "+esc(weekday)+"</div><div style='padding:10px 14px'>"+dishLines+"</div></div>";
  }).join("");
  const base="<div style='background:#f5f1e9;padding:24px 10px;font-family:Arial,sans-serif;color:#403328'><div style='max-width:620px;margin:auto;background:#fff'><div style='background:#403328;color:white;padding:28px;text-align:center;font-size:22px;font-weight:bold'>Kastélydomb Kávézó és Étterem</div><div style='padding:24px'><h2>Rendelési igényét megkaptuk</h2><p>Kedves "+esc(name)+"! Köszönjük a megrendelését. Az étterem külön visszaigazolja az elfogadását.</p><p><strong>Rendelésazonosító:</strong> "+esc(orderNumber)+"</p><p><strong>Átvétel:</strong> "+esc(fulfillmentHu)+(address?"<br><strong>Cím:</strong> "+esc(address):"")+"<br><strong>Fizetés:</strong> "+esc(paymentHu)+"</p><div style='width:100%;font-size:14px'>"+rows+"</div><p style='font-size:21px;text-align:right'><strong>Összesen: "+ft(total)+"</strong></p><div style='background:#faf7f0;text-align:center;padding:16px'><strong>Rendelés QR-kódja</strong><img src='"+esc(qrUrl)+"' alt='Rendelés QR-kódja' width='480' style='width:100%;max-width:480px;height:auto;display:block;margin:12px auto'><p>"+esc(orderNumber)+"</p></div><p>Ha módosítani vagy lemondani szeretné megrendelését, kérjük, hívjon minket a <a href='tel:+3688470350' style='color:#493329;font-weight:bold'>06 88 470 350</a> telefonszámon.</p><p style='font-size:12px'>Ez az üzenet a rendelési igény beérkezését igazolja, nem annak végleges elfogadását.</p></div></div></div>";
  const restaurantHtml=base.replace("Rendelési igényét megkaptuk","Új napi menürendelés").replace("<p>Kedves "+esc(name)+"! Köszönjük a megrendelését. Az étterem külön visszaigazolja az elfogadását.</p>","<p><strong>Megrendelő:</strong> "+esc(name)+"<br><strong>Telefon:</strong> "+esc(phone)+"<br><strong>E-mail:</strong> "+esc(email)+(isCompany?"<br><strong>Cég:</strong> "+esc(companyName)+"<br><strong>Székhely:</strong> "+esc(companyAddress)+"<br><strong>Adószám:</strong> "+esc(tax):"")+"</p>");
  const payload={event:"menu.order.created",is_test: process.env.VERCEL_ENV === "preview" || process.env.KASTELYDOMB_MODE !== "production",...recipients,order_id:id,order_number:orderNumber,customer_name:name,customer_phone:phone,customer_email:recipients.guest_email,customer_type:isCompany?"company":"private",company_name:isCompany?companyName:"",company_address:isCompany?companyAddress:"",tax_number:isCompany?tax:"",fulfillment:d.fulfillment,fulfillment_hu:fulfillmentHu,delivery_address:address,payment_method:d.payment,payment_method_hu:paymentHu,items,total_huf:total,total_hu:ft(total),qr_value:qrValue,qr_url:qrUrl,guest_html:base,restaurant_html:restaurantHtml,order_html:base,subject_guest:"Kastélydomb – menürendelése beérkezett – "+orderNumber,subject_restaurant:"Kastélydomb – új menürendelés – "+orderNumber};
  try {
    await persistAdminRow("kastelydomb_orders", {
      id, order_number: orderNumber, request_fingerprint: id,
      customer_name: name, customer_email: email, customer_phone: phone,
      customer_type: isCompany ? "company" : "private",
      company_name: isCompany ? companyName : null,
      company_address: isCompany ? companyAddress : null,
      tax_number: isCompany ? tax : null,
      fulfillment: d.fulfillment === "takeaway" ? "pickup" : d.fulfillment === "pickup" ? "dine_in" : "delivery",
      delivery_address: address || null,
      payment_method: d.payment === "transfer" ? "company_transfer" : d.payment === "cod-card" ? "card_on_pickup" : "cash_on_pickup",
      payment_status: "unpaid", status: "new", total_huf: total,
      items, notes: clean(d.note, 2000) || null, is_test: process.env.VERCEL_ENV === "preview" || process.env.KASTELYDOMB_MODE !== "production",
    });
  } catch { return bad("A rendelés adatbázisba mentése nem sikerült.",503); }
  try{await sendZapierOnce("menu",id,hook,payload)}
  catch{return bad("A rendelési értesítés állapota ellenőrzést igényel. Kérjük, hívja az éttermet a rendelésazonosító megadásával: "+orderNumber,502)}
  return NextResponse.json({ok:true,order_number:orderNumber,total_huf:total},{headers:{"Cache-Control":"no-store"}});
}