'use strict';
// Approved V1.3 offer layout enhancement. Server is source of truth for confirmation and payment.
let kdOfferPayPending=null;
let kdOfferPayBusy=false;
async function kdOfferConfirm(offerId,orderId){
 const r=state.offers.find(o=>o.id===offerId)?.orders.find(x=>x.id===orderId);
 if(!r || r.confirmed)return;
 try{
  await kdConfirm('special',r.uuid);
  openOffer(offerId,orderId);
 }catch(e){kdNotice(e.message||'A visszaigazolást nem sikerült menteni.');}
}
function kdOfferPaymentPrompt(offerId,orderId){
 const r=state.offers.find(o=>o.id===offerId)?.orders.find(x=>x.id===orderId);
 if(!r || r.paid)return;
 if(r.method==='Kiszállítás'){
  kdNotice('A kiszállításos rendelés fizetését a Kiszállítás menüpontban, a teljesítés után kell rögzíteni.');
  return;
 }
 kdOfferPayPending={offerId,orderId,uuid:r.uuid};
 modal('Fizetés megerősítése',
  '<div class="section" style="border:2px solid #2d694a;border-radius:14px">'+
  '<h3>Karácsonyi rendelés kifizetése</h3>'+
  '<div class="gridinfo">'+info('Megrendelő',r.name)+info('Rendelési azonosító',r.id)+
  info('Fizetendő teljes összeg',money(r.orderTotal))+'</div>'+
  '<label class="field" style="display:block;margin:16px 0">Tényleges fizetési mód'+
  '<select id="kd-offer-payment-method" style="width:100%;max-width:290px;display:block;padding:10px;margin-top:7px">'+
  '<option value="">Válasszon fizetési módot</option><option value="cash">Készpénz</option>'+
  '<option value="card">Bankkártya</option></select></label>'+
  '<p class="hint">A fizetést a teljes megrendeléshez, egyszer rögzítjük.</p>'+
  '<div class="actions" style="margin-top:16px"><button class="btn" onclick="kdOfferPayPending=null;modalClose()">Mégse</button>'+
  '<button id="kd-offer-pay-confirm" class="btn primary" onclick="kdOfferCommitPayment()">Fizetés rögzítése</button></div></div>');
}
async function kdOfferCommitPayment(){
 if(!kdOfferPayPending||kdOfferPayBusy)return;
 const method=q('#kd-offer-payment-method')?.value;
 if(!['cash','card'].includes(method)){kdNotice('Válassza ki, hogy készpénzzel vagy bankkártyával fizettek.');return;}
 const pending=kdOfferPayPending;
 kdOfferPayBusy=true;
 const btn=q('#kd-offer-pay-confirm');
 if(btn){btn.disabled=true;btn.textContent='Fizetés rögzítése…';}
 try{
  await kdFetch('/api/admin/special-payment',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id:pending.uuid,method})
  });
  kdOfferPayPending=null;
  modalClose();
  await kdLoad();
  openOffer(pending.offerId,pending.orderId);
 }catch(e){
  kdOfferPayPending=null;
  kdNotice((e&&e.message)||'A fizetés eredményét ellenőrizni kell, mielőtt újra próbálkozik.');
 }finally{kdOfferPayBusy=false;}
}
openOffer=function(oid,id){
 const o=state.offers.find(x=>x.id===oid),r=o?.orders.find(x=>x.id===id);
 if(!r)return;
 const confirmed=!!r.confirmed;
 const paymentLabel=r.receipt ? (r.receipt.method==='cash'?'Készpénz':'Bankkártya') : r.payment;
 const confirmation='<div style="display:flex;justify-content:flex-end;margin-top:17px">'+
  '<button class="btn '+(confirmed?'primary':'warn')+'" '+
  (confirmed?'disabled':'onclick="kdOfferConfirm(\''+escapeAttr(oid)+'\',\''+escapeAttr(id)+'\')"')+
  ' style="font-weight:800;min-width:170px">'+(confirmed?'Visszaigazolva':'Visszaigazolásra vár')+'</button></div>';
 const paymentButton='<div style="display:flex;justify-content:flex-end;margin-top:18px">'+
  '<button class="btn primary" '+(r.paid?'disabled':'onclick="kdOfferPaymentPrompt(\''+escapeAttr(oid)+'\',\''+escapeAttr(id)+'\')"')+
  ' style="min-width:145px">'+(r.paid?'Fizetve':'Fizetés')+'</button></div>';
 const form='<div class="section"><h3>1. Ügyféladatok</h3>'+
  '<div class="gridinfo">'+info('Név',r.name)+info('Telefon',r.phone)+
  info('E-mail',r.email)+info('Cím',r.address||'—')+'</div></div>'+
  '<div class="section"><h3>2. Megrendelés alapadatai</h3>'+
  '<div class="gridinfo">'+info('Azonosító',r.id)+info('Ajánlat',o.title)+
  info('Átvétel időpontja',dateHU(o.pickup))+info('Átvételi mód',r.method)+
  info('Fizetési mód',paymentLabel)+'</div>'+confirmation+'</div>'+
  '<div class="section"><h3>3. Megrendelt tételek</h3>'+
  r.items.map(i=>'<div class="dayrow"><span>'+esc(i.name)+' · '+i.qty+' adag</span>'+
    '<b>'+money(i.qty*i.price)+'</b></div>').join('')+
  '<div class="summary">Végösszeg: '+money(r.orderTotal)+'</div></div>'+
  '<div class="section"><h3>4. Fizetés</h3>'+paymentButton+'</div>'+
  '<div class="section"><h3>5. Belső megjegyzések</h3>'+
  '<textarea id="internal-note" rows="3" style="width:100%;padding:10px;border:1px solid #ccdcd0;border-radius:8px" '+
  (ui.role==='courier'?'disabled':'')+'>'+esc(r.note)+'</textarea>'+
  (ui.role!=='courier'?'<p><button class="btn small" onclick="saveNote(\'offer\',\''+escapeAttr(id)+'\')">Megjegyzés mentése</button></p>':'')+
  '</div>';
 modal(o.title+' · '+r.id,form);
};