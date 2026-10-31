import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const serverUrl=pathToFileURL(require.resolve('next/server')).href;
const {NextRequest}=await import(serverUrl);
const source=await readFile(new URL('../src/app/api/inquiries/route.ts',import.meta.url),'utf8');
const routingSource=await readFile(new URL('../src/lib/email-routing.ts',import.meta.url),'utf8');
const routingUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(routingSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"next/server"',JSON.stringify(serverUrl)).replace('"@/lib/email-routing"',JSON.stringify(routingUrl));
const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const envKeys=['CONTACT_ZAPIER_WEBHOOK_URL','RESERVATION_ZAPIER_WEBHOOK_URL','KASTELYDOMB_MODE','INQUIRY_LIVE_EMAILS_ENABLED','VERCEL_ENV','CLIENT_TEST_EMAILS_ENABLED'];
const contact={type:'contact',name:'TESZT Vendég <script>',phone:'+36 30 000 0000',email:'no-send@example.invalid',privacy:true,message:'Tesztüzenet <img src=x onerror=alert(1)>'};
const booking={...contact,type:'reservation',date:'2030-11-01',time:'26:30',guests:'2',note:'TESZT foglalás'};
const request=(body,headers={})=>new NextRequest('https://preview.example/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
async function configured(overrides,check){
 const previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));const savedFetch=globalThis.fetch;const calls=[];
 try{
  for(const k of envKeys)delete process.env[k];
  Object.assign(process.env,{KASTELYDOMB_MODE:'test',VERCEL_ENV:'preview',CONTACT_ZAPIER_WEBHOOK_URL:'https://hooks.zapier.com/hooks/catch/123/contact/',RESERVATION_ZAPIER_WEBHOOK_URL:'https://hooks.zapier.com/hooks/catch/123/reservation/',...overrides});
  globalThis.fetch=async(url,init)=>{calls.push({url,payload:JSON.parse(init.body)});return new Response('{}',{status:200})};
  await check(calls);
 }finally{globalThis.fetch=savedFetch;for(const k of envKeys)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k]}
}
test('contact produces two branded HTML messages addressed only to the test recipient',()=>configured({},async calls=>{
 const r=await POST(request(contact));assert.equal(r.status,200);const body=await r.json();assert.equal(body.is_test,true);assert.ok(body.request_id);
 assert.equal(calls.length,1);assert.match(calls[0].url,/contact/);const p=calls[0].payload;
 assert.equal(p.restaurant_email,'tippanzsolt@gmail.com');assert.equal(p.guest_email,'tippanzsolt@gmail.com');assert.equal(p.guest_email_original,undefined);assert.equal(p.request_id,body.request_id);
 for(const role of ['guest','restaurant']){assert.match(p['subject_'+role],/^\[TESZT\]/);assert.match(p[role+'_html'],/#403328/);assert.match(p[role+'_html'],/#f5f1e9/);assert.match(p[role+'_html'],/TESZTÜZEM/);assert.ok(p[role+'_html'].includes(body.request_id));assert.ok(!p[role+'_html'].includes('<script>'));assert.ok(!p[role+'_html'].includes('<img src=x'))}
}));
test('reservation handles Friday late-night arrival and requires separate restaurant acceptance',()=>configured({},async calls=>{
 const r=await POST(request(booking));assert.equal(r.status,200);const p=calls[0].payload;
 assert.equal(p.event,'reservation.requested');assert.match(p.subject_restaurant,/2030-11-02 02:30/);assert.match(p.subject_guest,/2030-11-02 02:30/);assert.match(p.guest_html,/2030-11-02/);assert.match(p.guest_html,/02:30 \(másnap hajnalban\)/);assert.match(p.guest_html,/külön visszaigazolása/);assert.equal(p.guest_email,'tippanzsolt@gmail.com');assert.equal(p.restaurant_email,'tippanzsolt@gmail.com');
}));
test('preview always forces test addresses even with production flags set',()=>configured({KASTELYDOMB_MODE:'production',INQUIRY_LIVE_EMAILS_ENABLED:'true'},async calls=>{assert.equal((await POST(request(contact))).status,200);assert.equal(calls[0].payload.is_test,true);assert.equal(calls[0].payload.guest_email,'tippanzsolt@gmail.com');assert.equal(calls[0].payload.restaurant_email,'tippanzsolt@gmail.com')}));
test('production gate blocks status and sending unless explicitly enabled',()=>configured({KASTELYDOMB_MODE:'production',VERCEL_ENV:'production'},async calls=>{const s=await (await GET()).json();assert.equal(s.contact,false);assert.equal(s.reservation,false);assert.equal((await POST(request(contact))).status,503);assert.equal(calls.length,0)}));
test('missing or invalid webhook keeps intake closed',()=>configured({CONTACT_ZAPIER_WEBHOOK_URL:'https://wrong.example/'},async calls=>{assert.equal((await POST(request(contact))).status,503);assert.equal((await (await GET()).json()).contact,false);assert.equal(calls.length,0)}));
test('invalid bodies and privacy consent never send email',()=>configured({},async calls=>{for(const value of [null,[],42,{...contact,privacy:false},{...contact,email:'bad'}])assert.equal((await POST(request(value))).status,400);assert.equal(calls.length,0)}));
test('invalid dates, past dates, fractional guests and invalid times never send email',()=>configured({},async calls=>{for(const patch of [{date:'2030-02-30'},{date:'2020-01-01'},{guests:'1.5'},{time:'24:99'},{time:'27:00'},{time:'09:30'},{date:'2030-11-03',time:'22:00'},{date:'2030-11-03',time:'24:30'}])assert.equal((await POST(request({...booking,...patch}))).status,400,JSON.stringify(patch));assert.equal(calls.length,0)}));
test('cross-origin and oversized requests are rejected without relying on Content-Length',()=>configured({},async calls=>{assert.equal((await POST(request(contact,{origin:'https://other.example'}))).status,403);assert.equal((await POST(request({...contact,message:'a'.repeat(13000)}))).status,413);assert.equal(calls.length,0)}));
test('webhook failure returns failure to the form, not a success message',()=>configured({},async()=>{globalThis.fetch=async()=>new Response('error',{status:500});assert.equal((await POST(request(contact))).status,502);globalThis.fetch=async()=>{throw Error('timeout')};assert.equal((await POST(request(contact))).status,502)}));

test('client acceptance sends guest and restaurant notifications with agency BCC for both forms',()=>configured({CLIENT_TEST_EMAILS_ENABLED:'true'},async calls=>{
 for(const form of [contact,booking]){
  assert.equal((await POST(request(form))).status,200);
  const p=calls.at(-1).payload;
  assert.equal(p.is_test,true);assert.equal(p.client_test,true);assert.equal(p.guest_email,contact.email);assert.equal(p.restaurant_email,'fenyocsaba@gmail.com');assert.equal(p.email_bcc,'tippanzsolt@gmail.com');assert.equal(p.original_guest_email_suppressed,false);
  for(const role of ['guest','restaurant']){assert.match(p[role+'_html'],/ÜGYFÉLTESZT/);assert.ok(!p[role+'_html'].includes('kizárólag a tesztcímre'));}
 }
}));
