import {NextRequest,NextResponse} from "next/server";
import {emailRecipients} from "@/lib/email-routing";
import {randomUUID} from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const dishes=[
["2026-11-02","Vöröslencseleves","Karfiolos-sajtos sertéstokány, párolt rizs","Hagymás csirkemáj, burgonya","Borzas szelet, párolt rizs"],
["2026-11-03","Zöldségleves","Bolognai spagetti, reszelt sajt","Vagdalt szelet, párolt rizs","Velővel töltött borda, pirított kockaburgonya"],
["2026-11-04","Csontleves daragaluskával","Főtt tojás, spenót, tört burgonya","Finomfőzelék, feltét","Natúr szelet pórémártással, párolt rizs"],
["2026-11-05","Árpagyöngyleves","Temesvári szelet, párolt rizs","Töltött csirkecomb, petrezselymes burgonya","Kassai töltött borda (sonka, tojás, zöldborsó), petrezselymes burgonya"],
["2026-11-06","Bakonyi betyárleves","Morzsás nudli","Káposztás tészta","Pankómorzsában sült csirkemellcsíkok, párolt rizs"]
];
const clean=(x:unknown,max=500)=>typeof x==="string"?x.trim().slice(0,max):"";
const esc=(x:unknown)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const bad=(error:string,status=400)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const current=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());const v=(s:string)=>p.find(x=>x.type===s)!.value;return {date:v("year")+"-"+v("month")+"-"+v("day"),minutes:Number(v("hour"))*60+Number(v("minute"))}};
const ft=(n:number)=>new Intl.NumberFormat("hu-HU").format(n)+" Ft";
export async function POST(req:NextRequest){
  const origin=req.headers.get("origin");if(origin && origin!==req.nextUrl.origin)return bad("Nem engedélyezett kérés.",403);
  if(process.env.VERCEL_ENV!=="preview" || process.env.KASTELYDOMB_MODE==="production")return bad("A megrendelés ezen a címen nem elérhető.",503);
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
  const id=randomUUID(),orderNumber="MENU-"+now.date.slice(2).replace(/-/g,"")+"-"+id.slice(0,8).toUpperCase();
  const fulfillmentHu=d.fulfillment==="delivery"?"Kiszállítás":d.fulfillment==="takeaway"?"Elvitel":"Helyben fogyasztás";
  const paymentHu=d.payment==="transfer"?"Céges banki átutalás":d.payment==="cod-card"?"Bankkártya az átvételkor":"Készpénz az átvételkor";
  const recipients=emailRecipients(email,true);
  const qrValue="KASTELYDOMB:MENU:"+id,qrUrl="https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=16&data="+encodeURIComponent(qrValue);
  const rows=items.map(i=>"<tr><td style='padding:10px;border-bottom:1px solid #e8dccb'>"+esc(i.date)+"</td><td style='padding:10px;border-bottom:1px solid #e8dccb'>"+esc(i.menu==="soup"?"Leves":i.menu+" menü")+" – "+esc(i.dish)+"</td><td style='padding:10px;border-bottom:1px solid #e8dccb'>"+i.quantity+" adag</td></tr>").join("");
  const base="<div style='background:#f5f1e9;padding:24px 10px;font-family:Arial,sans-serif;color:#403328'><div style='max-width:620px;margin:auto;background:#fff'><div style='background:#403328;color:white;padding:28px;text-align:center;font-size:22px;font-weight:bold'>Kastélydomb Kávézó és Étterem</div><div style='padding:24px'><h2>Rendelési igényét megkaptuk</h2><p>Kedves "+esc(name)+"! Köszönjük a megrendelését. Az étterem külön visszaigazolja az elfogadását.</p><p><strong>Rendelésazonosító:</strong> "+esc(orderNumber)+"</p><p><strong>Átvétel:</strong> "+esc(fulfillmentHu)+(address?"<br><strong>Cím:</strong> "+esc(address):"")+"<br><strong>Fizetés:</strong> "+esc(paymentHu)+"</p><table style='width:100%;border-collapse:collapse;font-size:13px'><thead><tr><th>Nap</th><th>Fogás</th><th>Adag</th></tr></thead><tbody>"+rows+"</tbody></table><p style='font-size:21px;text-align:right'><strong>Összesen: "+ft(total)+"</strong></p><div style='background:#faf7f0;text-align:center;padding:16px'><strong>Rendelés QR-kódja</strong><img src='"+esc(qrUrl)+"' alt='Rendelés QR-kódja' width='480' style='width:100%;max-width:480px;height:auto;display:block;margin:12px auto'><p>"+esc(orderNumber)+"</p></div><p>Ha módosítani vagy lemondani szeretné megrendelését, kérjük, hívjon minket a <a href='tel:+3688470350' style='color:#493329;font-weight:bold'>06 88 470 350</a> telefonszámon.</p><p style='font-size:12px'>Ez az üzenet a rendelési igény beérkezését igazolja, nem annak végleges elfogadását.</p></div></div></div>";
  const restaurantHtml=base.replace("Rendelési igényét megkaptuk","Új napi menürendelés").replace("<p>Kedves "+esc(name)+"! Köszönjük a megrendelését. Az étterem külön visszaigazolja az elfogadását.</p>","<p><strong>Megrendelő:</strong> "+esc(name)+"<br><strong>Telefon:</strong> "+esc(phone)+"<br><strong>E-mail:</strong> "+esc(email)+(isCompany?"<br><strong>Cég:</strong> "+esc(companyName)+"<br><strong>Székhely:</strong> "+esc(companyAddress)+"<br><strong>Adószám:</strong> "+esc(tax):"")+"</p>");
  const payload={event:"menu.order.created",is_test:true,...recipients,order_id:id,order_number:orderNumber,customer_name:name,customer_phone:phone,customer_email:recipients.guest_email,customer_type:isCompany?"company":"private",company_name:isCompany?companyName:"",company_address:isCompany?companyAddress:"",tax_number:isCompany?tax:"",fulfillment:d.fulfillment,fulfillment_hu:fulfillmentHu,delivery_address:address,payment_method:d.payment,payment_method_hu:paymentHu,items,total_huf:total,total_hu:ft(total),qr_value:qrValue,qr_url:qrUrl,guest_html:base,restaurant_html:restaurantHtml,order_html:base,subject_guest:"Kastélydomb – menürendelése beérkezett – "+orderNumber,subject_restaurant:"Kastélydomb – új menürendelés – "+orderNumber};
  try{const sent=await fetch(hook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});if(!sent.ok)return bad("A rendelés továbbítása nem sikerült. Kérjük, próbálja újra.",502)}
  catch{return bad("A rendelés továbbítása nem sikerült. Kérjük, próbálja újra.",502)}
  return NextResponse.json({ok:true,order_number:orderNumber,total_huf:total},{headers:{"Cache-Control":"no-store"}});
}