import {NextRequest} from "next/server";
import {db,body,guard,json,sessionAccount} from "@/lib/admin-server";
import {encryptPassword,passwordSecure,safeUsername} from "@/lib/admin-users";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type UserRow={id:string;full_name:string;username:string;role:string;active:boolean;created_at:string;last_login_at:string|null};
async function superadmin(req:NextRequest){
 const denied=await guard(req);if(denied)return {error:denied,actor:""};
 const account=await sessionAccount(req);
 if(!account||account.role!=="superadmin")return {error:json({error:"Csak a szuperadmin kezelhet felhasználókat."},403),actor:""};
 return {error:null,actor:account.username};
}
async function audit(actor:string,action:string,id:string){
 await db("kastelydomb_admin_user_audit",{method:"POST",body:JSON.stringify({
  actor_label:actor,action,target_user_id:id
 })});
}
export async function GET(req:NextRequest){
 const auth=await superadmin(req);if(auth.error)return auth.error;
 const r=await db("kastelydomb_admin_users?select=id,full_name,username,role,active,created_at,last_login_at&order=created_at.asc");
 if(!r.ok)return json({error:"A felhasználók nem érhetők el."},503);
 const roles=await db("kastelydomb_admin_role_permissions?select=role,pages&order=role");
 if(!roles.ok)return json({error:"A jogosultsági beállítások nem érhetők el."},503);
 return json({users:await r.json(),rolePermissions:await roles.json()});
}
export async function POST(req:NextRequest){
 const auth=await superadmin(req);if(auth.error)return auth.error;
 try{
  const p=await body(req,3000);
  const username=typeof p.username==="string"?safeUsername(p.username):"";
  const name=typeof p.name==="string"?p.name.trim():"";
  const password=p.password;
  if(!/^[a-z0-9._-]{3,40}$/.test(username)||name.length<2||name.length>120||
    !["office","desk","courier"].includes(p.role)||typeof password!=="string"||!passwordSecure(password))
    return json({error:"Érvénytelen adatok. A jelszó legalább 12 karakter legyen, betűvel, számmal és különleges karakterrel."},400);
  const r=await db("kastelydomb_admin_users",{method:"POST",body:JSON.stringify({
   username,full_name:name,role:p.role,password_hash:encryptPassword(password),active:true
  })});
  if(!r.ok)return json({error:"Felhasználó létrehozása sikertelen. A felhasználónév már foglalt lehet, vagy már van aktív futár."},409);
  const rows:UserRow[]=await r.json();
  if(rows[0])await audit(auth.actor,"create",rows[0].id);
  return json({ok:true},201);
 }catch{return json({error:"A felhasználó nem hozható létre."},503)}
}
export async function PATCH(req:NextRequest){
 const auth=await superadmin(req);if(auth.error)return auth.error;
 try{
  const p=await body(req,3000),id=p.id;
  if(p.action!=="permissions"&&(typeof id!=="string"||!/^[a-f0-9-]{36}$/i.test(id)))return json({error:"Érvénytelen felhasználó."},400);
  if(p.action==="permissions"){
   if(!["office","desk","courier"].includes(p.role)||!Array.isArray(p.pages)||
    p.pages.some((x:unknown)=>typeof x!=="string"||!["home","menu","offers","delivery","reservations","messages","clients"].includes(x)))
    return json({error:"Érvénytelen szerepkör vagy menüjogosultság."},400);
   const pages=Array.from(new Set(["home",...p.pages]));
   const update=await db("kastelydomb_admin_role_permissions?role=eq."+encodeURIComponent(p.role),{
     method:"PATCH",body:JSON.stringify({pages,updated_at:new Date().toISOString()})
   });
   if(!update.ok)return json({error:"A jogosultságok mentése sikertelen."},503);
   const roleUsers=await db("kastelydomb_admin_users?select=id&role=eq."+encodeURIComponent(p.role));
   if(!roleUsers.ok)return json({error:"A jogosultságok mentve, de a munkamenetek visszavonása nem ellenőrizhető."},503);
   for(const user of (await roleUsers.json()) as Array<{id:string}>){
     const revoke=await db("kastelydomb_admin_sessions?user_id=eq."+encodeURIComponent(user.id),{method:"DELETE"});
     if(!revoke.ok)return json({error:"A jogosultságok mentve, de a munkamenetek visszavonása részben sikertelen."},503);
   }
   await audit(auth.actor,"permissions_"+p.role,"00000000-0000-4000-8000-000000000000");
   return json({ok:true});
  }
  const fields:Record<string,unknown>={};
  let action="edit";
  if(p.action==="password"){
   if(typeof p.password!=="string"||!passwordSecure(p.password))
     return json({error:"A jelszó legalább 12 karakter, betűt, számot és különleges karaktert tartalmazzon."},400);
   fields.password_hash=encryptPassword(p.password);action="password_reset";
  }else if(p.action==="active"){
   if(typeof p.active!=="boolean")return json({error:"Érvénytelen állapot."},400);
   fields.active=p.active;action=p.active?"activate":"deactivate";
  }else if(p.action==="profile"){
   if(typeof p.name!=="string"||p.name.trim().length<2||p.name.trim().length>120||
      !["office","desk","courier"].includes(p.role))return json({error:"Érvénytelen név vagy szerepkör."},400);
   fields.full_name=p.name.trim();fields.role=p.role;action="role_or_name";
  }else return json({error:"Ismeretlen módosítás."},400);
  fields.updated_at=new Date().toISOString();
  const r=await db("kastelydomb_admin_users?id=eq."+encodeURIComponent(id)+"&select=id",{
   method:"PATCH",body:JSON.stringify(fields)
  });
  if(!r.ok)return json({error:"A módosítás nem sikerült. Lehet, hogy már van aktív futár."},409);
  const rows=await r.json();if(!Array.isArray(rows)||rows.length!==1)return json({error:"A felhasználó nem található."},404);
  if(action==="deactivate"||action==="password_reset"||action==="role_or_name"){
   const revoke=await db("kastelydomb_admin_sessions?user_id=eq."+encodeURIComponent(id),{method:"DELETE"});
   if(!revoke.ok)return json({error:"A fiók módosult, de a munkamenetek visszavonása nem sikerült. Ellenőrzés szükséges."},503);
  }
  await audit(auth.actor,action,id);
  return json({ok:true});
 }catch{return json({error:"A módosítás nem hajtható végre."},503)}
}
