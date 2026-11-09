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
  return task.items.map(i=>'<div class="dayrow"><span><b>'+esc(i.qty)+' × '+esc(i.name)+'</b>'+
    (i.menu==='soup'?' · leves':i.soup?' · levessel':' · leves nélkül')+
    (i.dish&&i.menu!=='soup'?'<br><small>'+esc(i.dish)+'</small>':'')+'</span></div>').join('');
}
function kdCourierExact(task){
  if(task.type==='offer')return true;
  const r=kdCourierRecord(task);
  const rows=(r?.originalItems||[]).filter(i=>i.date===task.date);
  return rows.length>0&&rows.every(i=>i.line_total_huf!==undefined&&Number.isFinite(Number(i.line_total_huf)));
}
delivery=function(){
  const day=ui.deliveryDate||today();
  const all=deliveryTasks(day),tasks=all.filter(t=>kdCourierMatch(t,kdCourierQuery));
  const completed=all.filter(t=>t.delivered),collected=all.filter(t=>t.collected);
  const sum=arr=>arr.reduce((v,t)=>v+t.amount,0);
  const cash=sum(collected.filter(t=>/készpénz/i.test(t.payment)));
  const card=sum(collected.filter(t=>/kártya/i.test(t.payment)));
  const settled=sum(collected.filter(t=>t.settled));
  const pending=sum(collected.filter(t=>!t.settled));
  const lookup='<div class="filters" style="margin-top:14px">'+
    '<label class="field" style="min-width:250px;flex:1">Keresés név vagy QR-kód alapján'+
    '<input id="kd-courier-search" type="search" style="width:100%" value="'+escapeAttr(kdCourierQuery)+
    '" placeholder="Vendég neve vagy QR-azonosító" oninput="kdCourierSearch(this.value)"></label>'+
    '<button class="btn primary" onclick="kdCourierCamera()">QR-kód beolvasása</button>'+
    '<button class="btn" onclick="kdCourierClear()">Keresés törlése</button>'+
    '<span id="kd-courier-count">'+tasks.length+' találat</span></div>';
  const rows=tasks.map(t=>'<tr class="kd-courier-row" data-key="'+escapeAttr(t.key)+'">'+
    '<td><b>'+esc(t.name)+'</b><br>'+esc(t.address)+'</td>'+
    '<td>'+kdCourierLineItems(t)+'</td>'+
    '<td><b>'+money(t.paid||t.settled?0:t.amount)+'</b><br><small>'+esc(t.payment)+'</small></td>'+
    '<td>'+badge(t.delivered,'Kiszállítva','Kiszállításra vár')+
    '<br>'+badge(t.settled,'Elszámolva',t.collected?'Pénz beszedve':'Fizetésre vár')+'</td>'+
    '<td><button class="btn small" onclick="openDelivery(\''+escapeAttr(t.key)+'\')">Megnézem</button></td></tr>').join('');
  return '<div class="panel"><div class="panel-head"><h2>Kiszállítási feladatok</h2>'+
    '<label class="field">Nap<input type="date" value="'+day+'" onchange="ui.deliveryDate=this.value;render()"></label></div>'+
    '<p class="muted">Egy futár · napi menü és alkalmi rendelések.</p>'+lookup+
    th(['Ügyfél és cím','Kiszállítandó tételek','Beszedendő','Állapot','Művelet'])+
    rows+(tasks.length?'':'<tr><td colspan="5" class="empty">Nincs kiszállítási feladat.</td></tr>')+
    tableEnd()+'<p id="kd-courier-nohits" style="display:none" class="muted">Nincs találat.</p></div>'+
    '<div class="panel"><h2>Napi futárelszámolás · '+dateHU(day)+'</h2><div class="gridinfo">'+
    info('Összes kiszállítási feladat',all.length+' cím/feladat')+
    info('Teljesített kiszállítások',completed.length+' feladat')+
    info('Beszedett összeg',money(sum(collected)))+
    info('Készpénz',money(cash))+info('Bankkártya',money(card))+
    info('Pultnál elszámolt',money(settled))+info('Elszámolásra vár',money(pending))+
    '</div><p class="hint">Az elszámolás a nap összes kiszállításából számolódik, a keresőszűrés nem módosítja.</p>'+
    controls('delivery')+'</div>';
};
openDelivery=function(key){
 const task=kdCourierAll().find(t=>t.key===key);if(!task)return;
 const r=kdCourierRecord(task);if(!r)return;
 const maps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(task.address);
 const exact=kdCourierExact(task);
 const other=r.days?'<div class="section"><h3>Teljes rendelés – további napok</h3>'+
   r.days.map(d=>'<div class="dayrow"><span>'+dateHU(d.date)+'</span><b>'+
   d.items.filter(i=>i.menu!=='soup').map(i=>i.qty+' × '+esc(i.name)).join(', ')+'</b></div>').join('')+'</div>':'';
 const actions='<div class="actions">'+
  '<button class="btn" onclick="deliveryAction(\''+escapeAttr(task.key)+'\',\'delivered\')" '+(task.delivered?'disabled':'')+'>Kiszállítva</button>'+
  '<button class="btn" onclick="deliveryAction(\''+escapeAttr(task.key)+'\',\'collected\')" '+
   (task.collected||task.paid||!task.delivered||!exact?'disabled':'')+'>'+
   (task.collected?'Pénz beszedve':'Fizetés teljesítve – pénz beszedve')+'</button>'+
  (ui.role!=='courier'?'<button class="btn primary" onclick="deliveryAction(\''+escapeAttr(task.key)+'\',\'settled\')" '+
   (task.settled||!task.collected?'disabled':'')+'>'+(task.settled?'Elszámolva':'Elszámolás jóváhagyása')+'</button>':'')+
  '</div>';
 modal('Kiszállítás · '+dateHU(task.date)+' · '+esc(task.name),
  '<div class="section"><h3>Vendég és szállítási adatok</h3><div class="gridinfo">'+
  info('Név',task.name)+info('Telefon',task.phone)+info('E-mail',r.email)+
  info('Szállítási cím',task.address)+info('Dátum',dateHU(task.date))+'</div>'+
  '<p><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(maps)+'">Google Térkép megnyitása</a> '+
  '<a class="btn" href="tel:'+escapeAttr(task.phone)+'">Hívás</a></p></div>'+
  '<div class="section"><h3>Pontosan kiszállítandó ételek</h3>'+kdCourierLineItems(task)+'</div>'+
  other+'<div class="section"><h3>Megjegyzés</h3><p>'+esc(r.note||'Nincs megjegyzés.')+'</p></div>'+
  '<div class="section"><h3>Fizetés és elszámolás</h3><div class="gridinfo">'+
  info('Fizetési mód',task.payment)+info('Napi összeg',money(task.amount))+
  info('Beszedendő',money(task.paid||task.settled?0:task.amount))+
  info('Kiszállítás',task.delivered?'Kiszállítva':'Kiszállításra vár')+
  info('Pénzbeszedés',task.collected?'Pénz beszedve':'Fizetésre vár')+
  info('Pultos elszámolás',task.settled?'Elszámolva':'Elszámolásra vár')+'</div>'+
  (!exact?'<p class="hint">Régebbi megrendelés: a napi összeg ellenőrzéséig a pénzbeszedés lezárása nem engedélyezett.</p>':'')+
  actions+'</div>'+kdQrBlock(task.type==='menu'?'KASTELYDOMB:MENU:'+r.uuid:r.id));
};
