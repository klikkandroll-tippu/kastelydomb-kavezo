"use client";
import {useEffect,useState} from "react";
export default function AdminPage(){
 const [authenticated,setAuthenticated]=useState<boolean|null>(null);
 const [password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{fetch("/api/admin/session",{cache:"no-store"}).then(r=>r.json()).then(d=>setAuthenticated(Boolean(d.authenticated))).catch(()=>setAuthenticated(false))},[]);
 async function login(){
   setBusy(true);setError("");
   try{
    const r=await fetch("/api/admin/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
    const d=await r.json();if(!r.ok)throw Error(d.error||"Sikertelen belépés.");
    setAuthenticated(true);setPassword("");
   }catch(e){setError(e instanceof Error?e.message:"Belépési hiba.");}
   finally{setBusy(false)}
 }
 if(authenticated===null)return <p style={{padding:30}}>Adminfelület betöltése…</p>;
 if(authenticated)return <iframe title="Kastélydomb admin V1.3 – integrációs teszt" allow="camera" src="/api/admin/shell" style={{position:"fixed",inset:0,width:"100%",height:"100%",border:0,background:"#f5f7f5"}} />;
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f7f5",fontFamily:"system-ui,Arial"}}>
  <section style={{padding:32,border:"1px solid #dce8df",background:"white",borderRadius:16,width:"min(420px,90vw)"}}>
  <h1 style={{marginTop:0,color:"#124731"}}>Kastélydomb admin</h1>
  <p>V1.3 · Integrációs teszt folyamatban</p>
  <label>Adminjelszó<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void login()}} style={{display:"block",width:"100%",padding:12,margin:"12px 0",boxSizing:"border-box"}}/></label>
  <button disabled={busy||!password} onClick={()=>void login()} style={{padding:"11px 22px",background:"#196b49",color:"white",border:0,borderRadius:9,cursor:"pointer"}}>Belépés</button>
  {error&&<p style={{color:"#b33"}}>{error}</p>}</section></main>;
}
