import {randomBytes,scryptSync,timingSafeEqual} from "node:crypto";
export type NamedRole="office"|"desk"|"courier";
export type SessionAccount={id:string|null;role:"superadmin"|NamedRole;username:string;full_name:string};
export const PAGES={
 superadmin:["home","menu","offers","delivery","reservations","messages","clients","settings"],
 office:["home","menu","offers","delivery","reservations","messages","clients"],
 desk:["home","menu","offers","delivery","reservations","messages"],
 courier:["home","delivery"]
} as const;
export function passwordSecure(value:string){
 return value.length>=12&&value.length<=128&&/[a-záéíóöőúüű]/i.test(value)&&/[0-9]/.test(value)&&/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(value);
}
export function encryptPassword(value:string){
 const salt=randomBytes(16).toString("hex");
 const digest=scryptSync(value,Buffer.from(salt,"hex"),64,{N:16384,r:8,p:1}).toString("hex");
 return "scrypt$16384$"+salt+"$"+digest;
}
export function verifyPassword(value:string,stored:string){
 try{
  const [algo,cost,salt,expected]=stored.split("$");
  if(algo!=="scrypt"||cost!=="16384"||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(expected))return false;
  const generated=scryptSync(value,Buffer.from(salt,"hex"),64,{N:16384,r:8,p:1});
  return timingSafeEqual(generated,Buffer.from(expected,"hex"));
 }catch{return false}
}
export const safeUsername=(value:string)=>value.trim().toLowerCase();
