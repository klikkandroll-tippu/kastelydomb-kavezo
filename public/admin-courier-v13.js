'use strict';
// Kastelydomb V1.3 courier-only enhancement; original approved HTML stays intact.
let kdCourierQuery='';
let kdQrStream=null,kdQrFrame=null,kdQrRunning=false;
function kdQrStop(){
  kdQrRunning=false;
  if(kdQrFrame!==null)cancelAnimationFrame(kdQrFrame);
  kdQrFrame=null;
  if(kdQrStream){kdQrStream.getTracks().forEach(t=>t.stop());kdQrStream=null;}
}
const kdPreviousModalClose=modalClose;
modalClose=function(){kdQrStop();kdPreviousModalClose();};
function kdCourierRecord(t){
  return t.type==='menu'?state.menus.find(r=>r.id===t.id):
    state.offers.find(o=>o.id===t.offerId)?.orders.find(r=>r.id===t.id);
}
function kdCourierMatch(t,q){
  q=String(q||'').trim().toLocaleLowerCase('hu-HU');
  if(!q)return true;
  const r=kdCourierRecord(t);
  return [t.name,t.address,t.phone,t.id,r?.uuid,t.type==='menu'?'KASTELYDOMB:MENU:'+r?.uuid:'']
    .some(x=>String(x||'').toLocaleLowerCase('hu-HU').includes(q));
}
function kdCourierRows(){
  return Array.from(document.querySelectorAll('.kd-courier-row'));
}
function kdCourierSearch(text){
  kdCourierQuery=String(text||'');
  let visible=0;
  const lookup=new Map(deliveryTasks(ui.deliveryDate||today()).map(t=>[t.key,t]));
  kdCourierRows().forEach(row=>{
    const task=lookup.get(row.dataset.key);
    const ok=Boolean(task&&kdCourierMatch(task,kdCourierQuery));
    row.style.display=ok?'':'none';
    if(ok)visible++;
  });
  const count=q('#kd-courier-count');
  if(count)count.textContent=visible+' találat';
  const empty=q('#kd-courier-nohits');
  if(empty)empty.style.display=visible?'none':'block';
}
function kdCourierClear(){kdCourierQuery='';render();}
function kdCourierAll(){
  const dates=new Set();
  state.menus.filter(r=>r.method==='Kiszállítás').forEach(r=>r.days.forEach(d=>dates.add(d.date)));
  state.offers.forEach(o=>{if(o.orders.some(r=>r.method==='Kiszállítás'))dates.add(o.pickup)});
  return Array.from(dates).flatMap(d=>deliveryTasks(d));
}
function kdCourierScanned(raw){
  const value=String(raw||'').trim();
  if(!value){kdNotice('Adjon meg egy QR-kódot.');return;}
  const match=kdCourierAll().find(t=>{
    const r=kdCourierRecord(t);
    return r&&(value===t.id||value===r.uuid||value==='KASTELYDOMB:MENU:'+r.uuid);
  });
  modalClose();
  if(!match){
    kdCourierQuery=value;ui.page='delivery';render();
    kdNotice('Ehhez a QR-kódhoz nincs kiszállítási feladat. Ellenőrizze a rendelési azonosítót.');
    return;
  }
  ui.page='delivery';ui.deliveryDate=match.date;kdCourierQuery='';render();openDelivery(match.key);
}
function kdCourierManual(){kdCourierScanned(q('#kd-camera-manual')?.value||'');}
async function kdCourierCamera(){
  kdQrStop();
  modal('QR-kód beolvasása','<div class="section"><p>Mutassa a rendelési e-mail QR-kódját a kamerának.</p>'+
    '<video id="kd-camera-video" autoplay muted playsinline style="width:100%;max-height:330px;background:#1d3027;border-radius:12px"></video>'+
    '<p class="muted" id="kd-camera-status">A kamera indítása…</p>'+
    '<label class="field">QR-kód tartalma<input id="kd-camera-manual" style="width:100%" placeholder="A QR-kód szövege kézzel is megadható"></label>'+
    '<div class="actions"><button class="btn primary" onclick="kdCourierManual()">Keresés</button>'+
    '<button class="btn" onclick="modalClose()">Bezárás</button></div></div>');
  const status=q('#kd-camera-status'),video=q('#kd-camera-video');
  if(!navigator.mediaDevices?.getUserMedia){status.textContent='A kamera nem érhető el. Használja a kézi keresést.';return;}
  if(!window.BarcodeDetector){status.textContent='A böngészőben nincs QR-felismerő. Másolja be a QR-kód szövegét.';return;}
  try{
    kdQrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(!q('#kd-camera-video')){kdQrStop();return;}
    video.srcObject=kdQrStream;
    await video.play();
    const detector=new window.BarcodeDetector({formats:['qr_code']});
    kdQrRunning=true;
    status.textContent='A kamera aktív. Helyezze a QR-kódot a kép közepére.';
    const tick=async()=>{
      if(!kdQrRunning)return;
      try{
        const detected=await detector.detect(video);
        if(detected.length&&detected[0].rawValue){kdCourierScanned(detected[0].rawValue);return;}
      }catch{}
      if(kdQrRunning)kdQrFrame=requestAnimationFrame(tick);
    };
    kdQrFrame=requestAnimationFrame(tick);
  }catch{
    kdQrStop();if(status)status.textContent='Nem sikerült megnyitni a kamerát. Engedélyezze a kamerát, vagy használja a kézi keresést.';
  }
}
function kdCourierLineItems(task){
  const order={soup:0,A:1,B:2,C:3};
  return task.items.slice().sort((a,b)=>(order[a.menu]??4)-(order[b.menu]??4)).map(i=>{
    const qty=Number(i.qty)||0;
    const name=String(i.dish||i.name||'').trim();
    const label=i.menu==='soup'?'Leves':['A','B','C'].includes(i.menu)?i.menu+'-menü':'';
    const title=label?label+': '+name:name;
    return '<div class="dayrow"><span><b>'+esc(title)+'</b> '+qty+' db</span></div>';
  }).join('');
}
function kdCourierMapAddress(address){
  // Keep full delivery address on the order; remove intercom, floor/door
  // and apartment details ONLY for the Google Maps search query.
  const text=String(address||'').trim();
  if(!text)return '';
  const cleaned=text.split(/(?:kaputelefon|csengő|emelet|ajtó|lakás|épület)\s*:/i)[0].trim();
  const chunks=cleaned.split(',').map(x=>x.trim()).filter(Boolean);
  if(chunks.length>=2){
    const street=chunks[1].replace(/\s+\d+\s*\/\s*\d+\s*$/,'').trim();
    return chunks[0]+', '+street;
  }
  return cleaned.replace(/\s+\d+\s*\/\s*\d+\s*$/,'').trim();
}
function kdCourierExact(task){
  if(task.type==='offer')return true;
  const r=kdCourierRecord(task);
  const rows=(r?.originalItems||[]).filter(i=>i.date===task.date);
  return rows.length>0&&rows.every(i=>i.line_total_huf!==undefined&&Number.isFinite(Number(i.line_total_huf)));
}

function kdCourierFullDue(task){
 const r=kdCourierRecord(task);
 return r && !r.paid ? Number(r.orderTotal||0) : 0;
}
function kdCourierReceiptForDay(date){
 const all=Array.isArray(state.receipts)?state.receipts:[];
 return all.filter(r=>{
  if(!r.collected_at)return false;
  const localDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.collected_at));
  return localDate===date;
 });
}
function kdCourierReceiptSum(items){return items.reduce((n,r)=>n+Number(r.amount_huf||0),0);}
function kdCourierPaymentChoice(){
 const e=q('#kd-courier-payment');
 if(!e || !['cash','card'].includes(e.value)){
  kdNotice('Válassza ki a tényleges fizetési módot: készpénz vagy bankkártya.');return;
 }
 return e.value;
}

let kdCourierTab='tasks';
let kdCourierPaymentPending=null;
let kdCourierSubmitting=false;
function kdCourierSetTab(tab){
 if(!['tasks','settlement'].includes(tab))return;
 kdCourierTab=tab;render();
}
function kdCourierFullDue(task){
 const r=kdCourierRecord(task);
 return r && !r.paid ? Number(r.orderTotal||0) : 0;
}
function kdCourierReceiptForDay(date){
 const all=Array.isArray(state.receipts)?state.receipts:[];
 return all.filter(r=>{
  if(!r.collected_at)return false;
  const localDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.collected_at));
  return localDate===date;
 });
}
function kdCourierReceiptSum(items){return items.reduce((n,r)=>n+Number(r.amount_huf||0),0);}
function kdCourierPaymentChoice(){
 const e=q('#kd-courier-payment');
 if(!e || !['cash','card'].includes(e.value)){
  kdNotice('Válassza ki a tényleges fizetési módot: készpénz vagy bankkártya.');return null;
 }
 return e.value;
}
function kdCourierPaymentConfirm(task,method,amount){
 const r=kdCourierRecord(task);
 if(!r)return;
 kdCourierPaymentPending={key:task.key,id:r.uuid,method,amount,kind:task.type==='menu'?'menu':'special',date:task.date};
 const label=method==='cash'?'Készpénz':'Bankkártya';
 modal('Fizetés megerősítése',
  '<div class="section" style="border:2px solid #2d694a;border-radius:14px"><h3>Teljes heti megrendelés</h3>'+
  '<div class="gridinfo">'+info('Megrendelő',r.name)+info('Rendelési azonosító',r.id)+
  info('Fizetési mód',label)+info('Rögzítendő összeg',money(amount))+'</div>'+
  '<p style="margin-top:14px">A fizetés jóváhagyásával a teljes rendelés <b>egyszer</b> kerül befizetett állapotba.</p>'+
  '<div class="actions" style="margin-top:18px">'+
  '<button class="btn" onclick="kdCourierPaymentPending=null;modalClose()">Mégse</button>'+
  '<button id="kd-courier-confirm" class="btn primary" onclick="kdCourierCommitPayment()">Fizetés rögzítése</button>'+
  '</div></div>');
}
async function kdCourierCommitPayment(){
 const pending=kdCourierPaymentPending;
 if(!pending||kdCourierSubmitting)return;
 kdCourierSubmitting=true;
 const button=q('#kd-courier-confirm');
 if(button){button.disabled=true;button.textContent='Fizetés rögzítése…';}
 try{
  await kdFetch('/api/admin/delivery-status',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({kind:pending.kind,id:pending.id,date:pending.date,action:'paid',payment:pending.method})
  });
  kdCourierPaymentPending=null;
  modalClose();
  await kdLoad();
  openDelivery(pending.key);
 }catch(e){
  kdCourierPaymentPending=null;
  kdNotice(e.message||'A fizetés nem rögzíthető. Ellenőrizze az állapotot újrapróbálás előtt.');
 }finally{kdCourierSubmitting=false;}
}
deliveryAction=async function(key,action){
 const task=kdCourierAll().find(t=>t.key===key),r=task?kdCourierRecord(task):null;
 if(!task||!r)return;
 if(!['delivered','paid'].includes(action)){kdNotice('Ez a művelet itt nem érhető el.');return;}
 if(action==='paid'&&!task.delivered){kdNotice('Először jelölje a kiszállítást teljesítettnek.');return;}
 if(action==='paid'&&r.paid){kdNotice('Ez a rendelés már ki van fizetve.');return;}
 if(action==='paid'&&r.partialPaid){kdNotice('Korábbi részfizetés szerepel a rendelésen. Pénzügyi egyeztetés szükséges.');return;}
 if(action==='paid'&&['Online bankkártya','Átutalás'].includes(r.payment)){
  kdNotice('Előre fizetett vagy átutalásos rendelésnél a futár nem szedhet be újabb összeget.');return;
 }
 if(action==='paid'){
  const method=kdCourierPaymentChoice();if(!method)return;
  const amount=kdCourierFullDue(task);
  if(!Number.isSafeInteger(amount)||amount<=0){kdNotice('Nem állapítható meg a rendelés beszedendő összege.');return;}
  kdCourierPaymentConfirm(task,method,amount);
  return;
 }
 try{
  await kdFetch('/api/admin/delivery-status',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({kind:task.type==='menu'?'menu':'special',id:r.uuid,date:task.date,action:'delivered'})});
  modalClose();await kdLoad();openDelivery(key);
 }catch(e){kdNotice(e.message||'Az állapot mentése nem sikerült.');}
};
function kdCourierSettlement(day){
 const receipts=kdCourierReceiptForDay(day);
 const cash=receipts.filter(r=>r.method==='cash'),card=receipts.filter(r=>r.method==='card');
 const totalCash=kdCourierReceiptSum(cash),totalCard=kdCourierReceiptSum(card);
 const details=receipts.map(r=>{
  const record=state.menus.find(o=>o.uuid===r.order_id)||
    state.offers.flatMap(o=>o.orders).find(o=>o.uuid===r.order_id);
  const method=r.method==='cash'?'Készpénz':'Bankkártya';
  const time=new Date(r.collected_at).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Budapest'});
  return '<tr><td>'+esc(record?.name||'Ismeretlen rendelő')+'</td>'+
    '<td>'+esc(method)+'</td><td><b>'+money(Number(r.amount_huf))+'</b></td><td>'+time+'</td></tr>';
 }).join('');
 return '<div class="panel"><div class="panel-head"><h2>Napi futárelszámolás</h2>'+
  '<label class="field">Nap<input type="date" value="'+day+'" onchange="ui.deliveryDate=this.value;render()"></label></div>'+
  '<div class="gridinfo">'+
  info('Aznap beszedett összeg',money(totalCash+totalCard))+
  info('Készpénzes fizetés',money(totalCash))+
  info('Bankkártyás fizetés',money(totalCard))+
  '</div><p class="hint">Az aznap ténylegesen beérkezett készpénzes és bankkártyás teljes rendelés-befizetések összege.</p>'+
  '<h3>Aznap rögzített befizetések</h3>'+
  th(['Megrendelő','Fizetési mód','Összeg','Időpont'])+
  (details||'<tr><td colspan="4" class="empty">Erre a napra még nincs rögzített futárbefizetés.</td></tr>')+
  tableEnd()+
  '<div style="margin-top:18px">'+controls('delivery')+'</div></div>';
}
delivery=function(){
 const day=ui.deliveryDate||today();
 const all=deliveryTasks(day),tasks=all.filter(t=>kdCourierMatch(t,kdCourierQuery));
 const tabs='<div class="tabs" style="margin-bottom:16px">'+
  '<button class="tab '+(kdCourierTab==='tasks'?'active':'')+'" onclick="kdCourierSetTab(\'tasks\')">Kiszállítási feladatok</button>'+
  '<button class="tab '+(kdCourierTab==='settlement'?'active':'')+'" onclick="kdCourierSetTab(\'settlement\')">Futárelszámolás</button></div>';
 if(kdCourierTab==='settlement')return tabs+kdCourierSettlement(day);
 const lookup='<div class="filters" style="margin-top:14px">'+
  '<label class="field" style="min-width:250px;flex:1">Keresés név vagy QR-kód alapján'+
  '<input id="kd-courier-search" type="search" style="width:100%" value="'+escapeAttr(kdCourierQuery)+
  '" placeholder="Vendég neve vagy QR-azonosító" oninput="kdCourierSearch(this.value)"></label>'+
  '<button class="btn primary" onclick="kdCourierCamera()">QR-kód beolvasása</button>'+
  '<button class="btn" onclick="kdCourierClear()">Keresés törlése</button>'+
  '<span id="kd-courier-count">'+tasks.length+' találat</span></div>';
 const rows=tasks.map(t=>{
  const r=kdCourierRecord(t);
  return '<tr class="kd-courier-row" data-key="'+escapeAttr(t.key)+'">'+
   '<td><b>'+esc(t.name)+'</b><br>'+esc(t.address)+'</td>'+
   '<td>'+kdCourierLineItems(t)+'</td>'+
   '<td><b>'+money(kdCourierFullDue(t))+'</b><br><small>'+esc(t.payment)+'</small></td>'+
   '<td>'+badge(t.delivered,'Kiszállítva','Kiszállításra vár')+
   '<br>'+badge(!!r?.paid,'Fizetve','Fizetésre vár')+'</td>'+
   '<td><button class="btn small" onclick="openDelivery(\''+escapeAttr(t.key)+'\')">Megnézem</button></td></tr>';
 }).join('');
 return tabs+'<div class="panel"><div class="panel-head"><h2>Kiszállítási feladatok</h2>'+
  '<label class="field">Nap<input type="date" value="'+day+'" onchange="ui.deliveryDate=this.value;render()"></label></div>'+
  '<p class="muted">Egy futár · a teljes rendelési összeg egyszer fizetendő.</p>'+lookup+
  th(['Ügyfél és cím','Kiszállítandó tételek','Beszedendő','Állapot','Művelet'])+
  rows+(tasks.length?'':'<tr><td colspan="5" class="empty">Nincs kiszállítási feladat.</td></tr>')+
  tableEnd()+'<p id="kd-courier-nohits" style="display:none" class="muted">Nincs találat.</p></div>';
};
function kdCourierShowWeekly(key){
 const task=kdCourierAll().find(t=>t.key===key),r=task?kdCourierRecord(task):null;
 if(!r)return;
 const days=Array.isArray(r.days)?r.days:[];
 const content=days.map(day=>{
  const items=day.items.slice().sort((a,b)=>(a.menu==='soup'?0:1)-(b.menu==='soup'?0:1)).map(i=>{
   const label=i.menu==='soup'?'Leves':i.menu?i.menu+'-menü':'Étel';
   return '<div class="dayrow"><span>'+esc(label+': '+(i.dish||i.name))+'</span><b>'+Number(i.qty||0)+' db</b></div>';
  }).join('');
  return '<div class="dayblock"><div class="dayhead">'+dateHU(day.date)+'</div><div class="daybody">'+items+'</div></div>';
 }).join('');
 const offerItems=!days.length?'<div class="daybody">'+kdCourierLineItems(task)+'</div>':'';
 modal('Teljes heti rendelés · '+esc(r.name),
  '<div class="section"><div class="gridinfo">'+info('Rendelési azonosító',r.id)+
  info('Teljes rendelés értéke',money(Number(r.orderTotal||0)))+'</div></div>'+
  '<div class="section"><h3>Rendelési tételek napi bontásban</h3>'+
  (content||offerItems)+'</div>'+
  '<div class="actions"><button class="btn" onclick="openDelivery(\''+escapeAttr(key)+'\')">Vissza a kiszállításhoz</button></div>');
}
openDelivery=function(key){
 const task=kdCourierAll().find(t=>t.key===key);if(!task)return;
 const r=kdCourierRecord(task);if(!r)return;
 const maps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(kdCourierMapAddress(task.address));
 const due=kdCourierFullDue(task),paid=!!r.paid;
 const paymentOptions=paid?'':(
  '<label class="field" style="display:block;margin:14px 0">Fizetéskor választott mód'+
  '<select id="kd-courier-payment" style="display:block;min-width:230px;margin-top:6px;padding:10px" aria-label="Fizetés módja">'+
  '<option value="">Válasszon fizetési módot</option><option value="cash">Készpénz</option>'+
  '<option value="card">Bankkártya</option></select></label>');
 const deliveryButton='<button class="btn '+(task.delivered?'primary':'')+'" onclick="deliveryAction(\''+escapeAttr(task.key)+'\',\'delivered\')" '+
  (task.delivered?'disabled':'')+'>'+(task.delivered?'Kiszállítva':'Kiszállítva')+'</button>';
 const paidButton='<div class="actions">'+
  '<button class="btn primary" onclick="deliveryAction(\''+escapeAttr(task.key)+'\',\'paid\')" '+
  (paid||!task.delivered||r.partialPaid?'disabled':'')+'>'+(paid?'Fizetve':'Fizetve')+'</button></div>';
 modal('Kiszállítás · '+dateHU(task.date)+' · '+esc(task.name),
  '<div class="section"><h3>Vendég és szállítási adatok</h3><div class="gridinfo">'+
  info('Név',task.name)+info('Telefon',task.phone)+info('E-mail',r.email)+
  info('Szállítási cím',task.address)+info('Dátum',dateHU(task.date))+'</div>'+
  '<p><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(maps)+'">Google Térkép megnyitása</a> '+
  '<a class="btn" href="tel:'+escapeAttr(task.phone)+'">Hívás</a></p></div>'+
  '<div class="section" style="border:3px solid #2c7450;border-radius:14px;background:#fafcf9">'+
  '<div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">'+
  '<h3 style="margin:0">Pontosan kiszállítandó ételek</h3>'+deliveryButton+'</div>'+
  '<div style="margin-top:12px">'+kdCourierLineItems(task)+'</div></div>'+
  '<div class="section"><h3>Megjegyzés</h3><p>'+esc(r.note||'Nincs megjegyzés.')+'</p></div>'+
  '<div class="section"><h3>Fizetés és elszámolás</h3><div class="gridinfo">'+
  info('Rendelési azonosító',r.id)+
  info('Fizetési mód',paid&&r.receipt?(r.receipt.method==='cash'?'Készpénz':'Bankkártya'):r.payment)+
  info('Beszedendő összeg',money(due))+'</div>'+
  '<p><button class="btn" onclick="kdCourierShowWeekly(\''+escapeAttr(task.key)+'\')">Teljes heti rendelés megtekintése</button></p>'+
  (paid?'<p class="hint">A rendelés teljes összege már ki van fizetve.</p>':'')+
  (r.partialPaid?'<p class="hint">Korábbi részfizetés szerepel. Pénzügyi egyeztetés szükséges.</p>':'')+
  paymentOptions+paidButton+'</div>');
};
