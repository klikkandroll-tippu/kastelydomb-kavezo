'use strict';
let kdCurrentAccount=null;
let kdUserList=[];
let kdUsersBusy=false;
let kdRolePermissionRows=[];
const kdRoleLabels={office:'Iroda',desk:'Pultos',courier:'Futár'};
const kdRolePaths={
 office:'Kezdőlap, napi menü, rendelések, kiszállítás, asztalfoglalások, kapcsolatfelvétel, ügyfelek',
 desk:'Kezdőlap, napi menü, rendelések, kiszállítás, asztalfoglalások, kapcsolatfelvétel',
 courier:'Kezdőlap, kiszállítás'
};
async function kdAccountInit(){
 try{
  const result=await kdFetch('/api/admin/session');
  if(!result.authenticated||!result.account){document.location.reload();return;}
  kdCurrentAccount=result.account;
  const realRole=result.account.role==='superadmin'?'admin':result.account.role;
  ui.role=realRole;
  customPerms=JSON.parse(JSON.stringify(roleDefaults));
  if(realRole!=='admin'&&Array.isArray(result.account.pages))customPerms[realRole]=result.account.pages;
  const select=q('#role');
  if(select){
   select.value=realRole;
   select.disabled=true;
   select.title='A jogosultságot a szuperadmin kezeli';
  }
  // Display the actual session role and keep the UI's role selector read-only.
  const originalRoleChange=select?.getAttribute('onchange');
  if(select&&originalRoleChange)select.removeAttribute('onchange');
  const label=document.createElement('div');
  label.className='muted';
  label.style.cssText='font-size:12px;margin-top:5px;text-align:right';
  label.textContent=result.account.full_name+' · '+(realRole==='admin'?'Szuperadmin':kdRoleLabels[realRole]);
  select?.parentElement?.appendChild(label);
  render();
 }catch{kdNotice('Nem sikerült azonosítani a bejelentkezett felhasználót. Kérjük, frissítse az oldalt.');}
}
const kdOriginalGo=go;
go=function(page){kdOriginalGo(page);if(page==='settings'&&kdCurrentAccount?.role==='superadmin')kdLoadUsers()};
const kdOriginalSettings=settings;
settings=function(){
 if(kdCurrentAccount?.role!=='superadmin')return '<div class="panel">Ehhez a művelethez szuperadmin jogosultság szükséges.</div>';
 const create='<div class="panel"><h2>Felhasználók hozzáadása és kezelése</h2>'+
 '<p class="muted">Kizárólag a szuperadmin hozhat létre vagy módosíthat felhasználói fiókokat.</p>'+
 '<form id="kd-user-form" onsubmit="kdCreateUser(event)" autocomplete="off">'+
 '<div class="gridinfo">'+
 '<label class="field">Személy neve<input required id="kd-user-name" maxlength="120" autocomplete="off" placeholder="Teljes név"></label>'+
 '<label class="field">Felhasználónév<input required id="kd-user-login" maxlength="40" minlength="3" pattern="[a-zA-Z0-9._-]{3,40}" title="3–40 karakter; angol betűk, számok, pont, kötőjel vagy aláhúzás" autocomplete="off" placeholder="pl. kiss.anna"></label>'+
 '<label class="field">Kezdő jelszó<input required type="password" id="kd-user-password" minlength="12" maxlength="128" autocomplete="new-password" title="Legalább 12 karakter, betű, szám és különleges karakter"></label>'+
 '<label class="field">Jogosultsági kategória<select id="kd-user-role" required>'+
 '<option value="office">Iroda</option><option value="desk">Pultos</option><option value="courier">Futár</option>'+
 '</select></label></div><p class="hint">Legalább 12 karakteres jelszó szükséges, benne betűvel, számmal és különleges karakterrel. Jelszavakat nem jelenítünk meg és nem tárolunk olvasható formában.</p>'+
 '<button class="btn primary" id="kd-user-create" type="submit">Felhasználó hozzáadása</button><p id="kd-user-create-message" role="status" aria-live="polite" style="margin-top:10px"></p></form></div>';
 const list='<div class="panel"><div class="panel-head"><h2>Felhasználói fiókok</h2>'+
 '<button class="btn" onclick="kdLoadUsers()">Lista frissítése</button></div>'+
 '<p id="kd-user-message" class="muted"></p><div id="kd-user-list"><p class="muted">Felhasználók betöltése…</p></div></div>';
 const permissions='<div class="panel"><h2>Jogosultsági kategóriák – elérhető menüpontok</h2>'+
 '<p class="muted">A jelölések az adatbázisba menthetők. Változtatáskor az érintett felhasználók újra belépnek.</p>'+
 Object.entries(kdRolePaths).map(([role])=>
 '<div class="dayblock"><div class="dayhead">'+kdRoleLabels[role]+'</div>'+
 '<div class="daybody"><div class="permgrid">'+
 navItems.filter(([page])=>page!=='settings').map(([page,title])=>
 '<label class="perm"><input type="checkbox" data-role="'+role+'" data-page="'+page+'" '+
 (customPerms[role]?.includes(page)?'checked':'')+
 (page==='home'?' disabled':'')+'> '+esc(title)+'</label>').join('')+
 '</div><div class="actions"><button class="btn primary" onclick="kdSaveRolePermissions(\''+role+'\')">Jogosultságok mentése</button></div></div></div>').join('')+
 '<div class="notice">A Kezdőlap minden munkakörnél kötelező. A futárból egyszerre csak egy aktív fiók engedélyezett.</div></div>';
 return create+list+permissions;
};
function kdUserNotice(text){const node=q('#kd-user-message');if(node)node.textContent=text}
async function kdLoadUsers(){
 if(kdUsersBusy)return;
 kdUsersBusy=true;
 try{
  const data=await kdFetch('/api/admin/users');
  kdUserList=Array.isArray(data.users)?data.users:[];
  kdRolePermissionRows=Array.isArray(data.rolePermissions)?data.rolePermissions:[];
  for(const p of kdRolePermissionRows){if(kdRolePaths[p.role]&&Array.isArray(p.pages))customPerms[p.role]=p.pages;}
  // Refresh the account list in place; rendering the entire page here destroys
  // the submission form and its accessible status message during an async save.
  const node=q('#kd-user-list');
  if(!node)return;
  const roleOptions=(value)=>Object.entries(kdRoleLabels).map(([role,label])=>
   '<option value="'+role+'" '+(role===value?'selected':'')+'>'+label+'</option>').join('');
  node.innerHTML=kdUserList.length?kdUserList.map((u,i)=>
   '<div class="dayblock" style="padding:14px;margin-bottom:12px;border:1px solid #e0e9e1;border-radius:12px">'+
   '<div class="dayhead">'+esc(u.full_name)+' · '+esc(u.username)+' '+(u.active?'':'· Letiltva')+'</div>'+
   '<div class="daybody"><div class="gridinfo">'+
   '<label class="field">Személy neve<input id="kd-edit-name-'+i+'" value="'+escapeAttr(u.full_name)+'" maxlength="120"></label>'+
   '<label class="field">Szerepkör<select id="kd-edit-role-'+i+'">'+roleOptions(u.role)+'</select></label>'+
   '</div><div class="actions" style="margin-top:10px">'+
   '<button class="btn" onclick="kdUserEdit('+i+')">Adatok és szerepkör mentése</button>'+
   '<button class="btn" onclick="kdUserResetPassword('+i+')">Új jelszó beállítása</button>'+
   '<button class="btn '+(u.active?'danger':'')+'" onclick="kdUserToggle('+i+')">'+(u.active?'Fiók letiltása':'Fiók engedélyezése')+'</button>'+
   '</div><p class="muted">Utolsó belépés: '+(u.last_login_at?new Date(u.last_login_at).toLocaleString('hu-HU'):'Még nem lépett be')+'</p>'+
   '</div></div>').join(''):'<p>Még nincs létrehozott személyes fiók.</p>';
  kdUserNotice('A fiókok és jogosultságok a Supabase-adatbázisban tárolódnak.');
 }catch(e){kdUserNotice('A felhasználólista nem tölthető be: '+(e.message||'hiba'))}
 finally{kdUsersBusy=false}
}
async function kdSaveRolePermissions(role){
 if(!kdRolePaths[role])return;
 const pages=Array.from(document.querySelectorAll('input[data-role="'+role+'"][data-page]'))
  .filter(el=>el.checked).map(el=>el.dataset.page);
 try{
  await kdFetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'permissions',role,pages})});
  customPerms[role]=Array.from(new Set(['home',...pages]));
  kdUserNotice('A szerepkör jogosultságai elmentve. Az érintett felhasználók korábbi belépései lejártak.');
  await kdLoadUsers();
 }catch(e){kdUserNotice(e.message||'A jogosultságok nem menthetők.')}
}
function kdCreateError(message){
 const field=q('#kd-user-create-message');
 if(field){field.textContent=message;field.style.color='#a32424';}
 kdUserNotice(message);
}
async function kdCreateUser(event){
 event.preventDefault();
 const form=q('#kd-user-form');
 const button=q('#kd-user-create');
 const note=q('#kd-user-create-message');
 if(!form||!button)return;
 const p={name:q('#kd-user-name').value.trim(),
  username:q('#kd-user-login').value.trim().toLowerCase(),
  password:q('#kd-user-password').value,role:q('#kd-user-role').value};
 if(!/^[a-z0-9._-]{3,40}$/.test(p.username)){
  kdCreateError('A felhasználónév 3–40 karakter lehet, kizárólag ékezet nélküli betűkkel, számokkal, ponttal, kötőjellel vagy aláhúzással.');
  return;
 }
 if(p.password.length<12||!/[a-záéíóöőúüű]/i.test(p.password)||!/[0-9]/.test(p.password)||
  !/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(p.password)){
  kdCreateError('Nem megfelelő jelszó: legalább 12 karakter, minimum egy betű, egy szám és egy különleges karakter szükséges.');
  return;
 }
 button.disabled=true;
 button.textContent='Felhasználó mentése…';
 if(note){note.textContent='A felhasználó adatainak mentése folyamatban…';note.style.color='';}
 try{
  const result=await kdFetch('/api/admin/users',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)
  });
  if(!result.ok)throw Error('A szerver nem igazolta vissza a felhasználó létrehozását.');
  const currentForm=q('#kd-user-form');
  if(currentForm)currentForm.reset();
  await kdLoadUsers();
  if(!kdUserList.some(u=>u.username===p.username)){
   kdCreateError('A mentés visszaigazolása megérkezett, de az új felhasználó nem szerepel a listában. Ellenőrizze az adatbázist.');
  }else{
   const message='A felhasználó létrejött, és megjelent a listában. A jelszót biztonságos csatornán adja át.';
   if(note){note.textContent=message;note.style.color='#215a39';}
   kdUserNotice(message);
  }
 }catch(e){kdCreateError((e&&e.message)||'Nem sikerült létrehozni a felhasználót.')}
 finally{button.disabled=false;button.textContent='Felhasználó hozzáadása';}
}
async function kdUserEdit(i){
 const u=kdUserList[i];if(!u)return;
 try{
  await kdFetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   id:u.id,action:'profile',name:q('#kd-edit-name-'+i).value,role:q('#kd-edit-role-'+i).value
  })});
  await kdLoadUsers();kdUserNotice('A felhasználói adatok mentve. A korábbi munkameneteket visszavontuk.');
 }catch(e){kdUserNotice(e.message)}
}
function kdUserResetPassword(i){
 const u=kdUserList[i];if(!u)return;
 modal('Új jelszó beállítása · '+esc(u.full_name),
 '<div class="section"><label class="field">Új jelszó<input id="kd-reset-pass" type="password" autocomplete="new-password" minlength="12"></label>'+
 '<p class="hint">Legalább 12 karakter, betű, szám és különleges karakter. A régi jelszó érvényét veszti, a bejelentkezett munkamenetek megszűnnek.</p>'+
 '<div class="actions"><button class="btn" onclick="modalClose()">Mégse</button>'+
 '<button class="btn primary" onclick="kdUserSavePassword('+i+')">Új jelszó mentése</button></div></div>');
}
async function kdUserSavePassword(i){
 const u=kdUserList[i],password=q('#kd-reset-pass')?.value;
 if(!u||!password)return;
 try{
  await kdFetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   id:u.id,action:'password',password
  })});
  modalClose();await kdLoadUsers();
  kdUserNotice('Az új jelszó elmentve; a korábbi munkamenetek megszűntek.');
 }catch(e){kdNotice(e.message||'A jelszó nem módosítható.')}
}
function kdUserToggle(i){
 const u=kdUserList[i];if(!u)return;
 modal(u.active?'Felhasználó letiltása':'Felhasználó engedélyezése',
 '<div class="section"><p>'+esc(u.full_name)+' fiókja '+(u.active?'letiltásra':'újraaktiválásra')+' kerül.</p>'+
 '<div class="actions"><button class="btn" onclick="modalClose()">Mégse</button>'+
 '<button class="btn primary" onclick="kdUserToggleSave('+i+')">Megerősítés</button></div></div>');
}
async function kdUserToggleSave(i){
 const u=kdUserList[i];if(!u)return;
 try{
  await kdFetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   id:u.id,action:'active',active:!u.active
  })});
  modalClose();await kdLoadUsers();kdUserNotice('A fiók állapota megváltozott.');
 }catch(e){kdNotice(e.message||'A módosítás sikertelen.')}
}
void kdAccountInit();
