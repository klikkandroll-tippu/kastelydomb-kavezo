import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isTestMode = () => process.env.VERCEL_ENV === "preview" || process.env.KASTELYDOMB_MODE !== "production";
const intakeAllowed = () => isTestMode() || process.env.INQUIRY_LIVE_EMAILS_ENABLED === "true";
const enabled = (type: string) => {
  if (!intakeAllowed()) return "";
  const key = type === "reservation" ? "RESERVATION_ZAPIER_WEBHOOK_URL" : "CONTACT_ZAPIER_WEBHOOK_URL";
  const value = process.env[key] || "";
  return value.startsWith("https://hooks.zapier.com/hooks/catch/") ? value : "";
};
function html(title: string, intro: string, rows: [string, string][], footer: string) {
  return `<!doctype html><html lang="hu"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f1e9;font-family:Arial,Helvetica,sans-serif;color:#403328">
  <div style="padding:22px 10px"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e8dccb">
  <div style="background:#403328;color:#fff;text-align:center;padding:28px 16px">
  <div style="font-size:27px;font-weight:bold">Kastélydomb</div>
  <div style="font-size:14px;margin-top:4px">Kávézó és Étterem</div>
  <div style="font-size:13px;margin-top:14px">${esc(title)}</div></div>
  <div style="padding:24px 18px"><p style="font-size:16px;line-height:1.65">${esc(intro)}</p>
  <div style="background:#faf7f0;border:1px solid #e8dccb;border-radius:9px;overflow:hidden">
  ${rows.map(([k,v])=>`<div style="padding:12px 14px;border-bottom:1px solid #e8dccb;font-size:14px;line-height:1.65"><strong>${esc(k)}</strong><div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(v)}</div></div>`).join("")}</div>
  <p style="font-size:13px;line-height:1.7;margin-top:24px">${esc(footer)}</p></div>
  <div style="text-align:center;background:#f5f1e9;padding:18px;color:#68594c;font-size:12px">Kastélydomb Kávézó és Étterem</div></div></div></body></html>`;
}
export async function GET() {
  return NextResponse.json({ contact: Boolean(enabled("contact")), reservation: Boolean(enabled("reservation")), is_test: isTestMode() }, {headers: {"Cache-Control":"no-store"}});
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return NextResponse.json({error:"Nem engedélyezett kérés."},{status:403});
  if (Number(req.headers.get("content-length") || 0) > 12000) return NextResponse.json({error:"Túl hosszú üzenet."},{status:413});
  let raw: Record<string, unknown>;
  try {
    const body = await req.text();
    if (Buffer.byteLength(body, "utf8") > 12000) return NextResponse.json({error:"Túl hosszú üzenet."},{status:413});
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("Invalid body");
    raw = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({error:"Érvénytelen űrlap."},{status:400}); }
  const type = raw.type === "contact" ? "contact" : raw.type === "reservation" ? "reservation" : "";
  if (!type) return NextResponse.json({error:"Ismeretlen űrlap."},{status:400});
  const hook = enabled(type);
  if (!hook) return NextResponse.json({error:"Az űrlap fogadása jelenleg nem elérhető."},{status:503});
  if (raw.website) return NextResponse.json({ok:true});
  if (raw.privacy !== true) return NextResponse.json({error:"Az adatkezelési hozzájárulás kötelező."},{status:400});
  const get=(k:string,max=250)=>typeof raw[k]==="string" ? (raw[k] as string).trim().slice(0,max) : "";
  const name=get("name",120),phone=get("phone",50),email=get("email",200);
  if(!name||!phone||!validEmail(email)||/[\r\n]/.test(email)||name.length<2||phone.length<8) return NextResponse.json({error:"Ellenőrizze a kötelező mezőket."},{status:400});
  const rows: [string,string][]=[["Név",name],["Telefonszám",phone],["E-mail",email]];
  let heading="", subject="",guestIntro="",guestFooter="",restaurantIntro="";
  if(type==="contact") {
    const message=get("message",2500);
    if(!message) return NextResponse.json({error:"Adjon meg üzenetet."},{status:400});
    rows.push(["Üzenet",message]);
    heading="Kapcsolatfelvételi üzenet";
    subject="Kastélydomb – új kapcsolatfelvételi üzenet";
    guestIntro=`Kedves ${name}! Köszönjük, hogy írt nekünk. Üzenete megérkezett, munkatársunk hamarosan felveszi Önnel a kapcsolatot.`;
    guestFooter="Ez automatikus beérkezési visszaigazolás, kérjük, ne válaszoljon erre az e-mailre.";
    restaurantIntro="Új kapcsolatfelvételi üzenet érkezett a weboldalról. Kérjük, vegyék fel a kapcsolatot a küldővel.";
  } else {
    const date=get("date",10),time=get("time",5),guests=Number(get("guests",3)),note=get("note",1200);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date+"T12:00:00Z") : new Date("invalid");
    if(!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==date || !/^(?:[01]\d|2[0-6]):[0-5]\d$/.test(time) || !Number.isInteger(guests) || !(guests>=1&&guests<=20))return NextResponse.json({error:"Ellenőrizze a foglalási adatokat."},{status:400});
    const timeMinutes=Number(time.slice(0,2))*60+Number(time.slice(3));
    const day=d.getUTCDay(),closing=(day===5||day===6)?1620:1320;
    if(timeMinutes<600||timeMinutes>=closing) return NextResponse.json({error:"A kiválasztott időpont nyitvatartáson kívül esik."},{status:400});
    const todayParts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Budapest",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const part = (type: string) => todayParts.find(p=>p.type===type)!.value;
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    if(date < today) return NextResponse.json({error:"Elmúlt napra nem foglalható asztal."},{status:400});
    const arrival = new Date(date+"T00:00:00Z");
    if(timeMinutes>=1440) arrival.setUTCDate(arrival.getUTCDate()+1);
    const displayTime = String(Math.floor(timeMinutes/60)%24).padStart(2,"0")+":"+time.slice(3)+(timeMinutes>=1440?" (másnap hajnalban)":"");
    rows.push(["Választott nap",date],["Érkezés dátuma",arrival.toISOString().slice(0,10)],["Érkezés időpontja",displayTime],["Létszám",guests+" fő"]);
    if(note)rows.push(["Megjegyzés",note]);
    heading="Asztalfoglalási igény";
    subject="Kastélydomb – új asztalfoglalási igény – "+date+" "+time;
    guestIntro=`Kedves ${name}! Asztalfoglalási igényét megkaptuk. A foglalás csak az étterem külön visszaigazolása után válik véglegessé.`;
    guestFooter="Ha módosítaná vagy lemondaná foglalását, kérjük, vegye fel a kapcsolatot az étteremmel. Ez automatikus üzenet.";
    restaurantIntro="Új asztalfoglalási igény érkezett a weboldalról. Kérjük, ellenőrizzék a szabad helyeket és külön igazolják vissza a vendégnek.";
  }
  const isTest = isTestMode();
  const requestId = crypto.randomUUID();
  rows.unshift(["Igényazonosító",requestId]);
  if(isTest) {
    heading = "TESZT – "+heading;
    subject = "[TESZT] "+subject;
    const notice = "TESZTÜZEM: ez nem valódi megkeresés vagy foglalás. Mindkét e-mail kizárólag a tesztcímre érkezik. ";
    guestIntro = notice+guestIntro;
    restaurantIntro = notice+restaurantIntro;
  }
  if(!isTest && process.env.INQUIRY_LIVE_EMAILS_ENABLED !== "true")return NextResponse.json({error:"Az éles értesítések még nincsenek engedélyezve."},{status:503});
  const payload={ request_id:requestId, event: type==="contact"?"contact.created":"reservation.requested",is_test:isTest,restaurant_email:isTest?"tippanzsolt@gmail.com":"fenyocsaba@gmail.com",guest_email:isTest?"tippanzsolt@gmail.com":email,original_guest_email_suppressed:isTest,customer_name:name,guest_email_original:isTest?undefined:email,subject_restaurant:subject,subject_guest:subject.replace("új ","")+" – beérkezett",restaurant_html:html(heading,restaurantIntro,rows,"A vendégnek szóló igényt az étterem munkatársa kezelje."),guest_html:html(heading,guestIntro,rows,guestFooter)};
  try {
    const response=await fetch(hook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error("Webhook HTTP "+response.status);
  }catch{
    return NextResponse.json({error:"Az üzenetet nem sikerült továbbítani. Kérjük, próbálja újra vagy hívja az éttermet."},{status:502});
  }
  return NextResponse.json({ok:true,is_test:isTest,request_id:requestId});
}
