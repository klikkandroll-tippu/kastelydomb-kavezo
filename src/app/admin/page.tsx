"use client";
import {useEffect,useState} from "react";

type Account={id:string|null;username:string;full_name:string;role:string};
const ROLE_LABELS:Record<string,string>={superadmin:"Szuperadmin",office:"Iroda",desk:"Pultos",courier:"Futár"};

export default function AdminPage(){
 const [authenticated,setAuthenticated]=useState<boolean|null>(null);
 const [account,setAccount]=useState<Account|null>(null);
 const [password,setPassword]=useState("");
 const [username,setUsername]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [loggingOut,setLoggingOut]=useState(false);

 useEffect(()=>{
   let live=true;
   fetch("/api/admin/session",{cache:"no-store",credentials:"same-origin"})
     .then(async r=>{if(!r.ok)throw Error("Munkamenet nem érhető el.");return r.json()})
     .then(d=>{if(live){setAccount(d.account||null);setAuthenticated(Boolean(d.authenticated&&d.account))}})
     .catch(()=>{if(live){setAccount(null);setAuthenticated(false)}});
   return ()=>{live=false};
 },[]);

 async function login(){
   setBusy(true);setError("");
   try{
    const r=await fetch("/api/admin/session",{
      method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,password})
    });
    const d=await r.json();
    if(!r.ok||!d.authenticated||!d.account)throw Error(d.error||"Sikertelen belépés.");
    setAccount(d.account);setAuthenticated(true);setPassword("");setUsername("");
   }catch(e){setError(e instanceof Error?e.message:"Belépési hiba.");}
   finally{setBusy(false)}
 }

 async function logout(){
   if(loggingOut)return;
   setLoggingOut(true);setError("");
   try{
     const r=await fetch("/api/admin/session",{method:"DELETE",credentials:"same-origin",cache:"no-store"});
     if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||"A kijelentkezés nem sikerült.");
     // Removing the iframe also drops access to any private UI state.
     setAuthenticated(false);setAccount(null);setPassword("");setUsername("");
     window.location.replace("/admin");
   }catch(e){
     setError(e instanceof Error?e.message:"A kijelentkezés nem sikerült.");
     setLoggingOut(false);
   }
 }

 if(authenticated===null)return <p style={{padding:30}}>Adminfelület betöltése…</p>;
 if(authenticated)return <>
   <iframe title="Kastélydomb admin V1.3 – integrációs teszt" allow="camera" src="/api/admin/shell"
     style={{position:"fixed",inset:0,width:"100%",height:"100%",border:0,background:"#f5f7f5"}}/>
   <aside aria-label="Bejelentkezett felhasználó és kijelentkezés"
     style={{position:"fixed",bottom:12,left:12,zIndex:9999,maxWidth:240,minWidth:190,padding:12,
       background:"#fff",border:"1px solid #c9dfd1",borderRadius:12,
       boxShadow:"0 4px 20px rgba(10,40,22,.16)",fontFamily:"system-ui,Arial"}}>
     <div style={{fontSize:12,color:"#567161",fontWeight:600}}>Bejelentkezve</div>
     <div style={{fontSize:14,fontWeight:700,color:"#173a28",overflowWrap:"anywhere"}}>{account?.full_name||account?.username||"Admin"}</div>
     <div style={{fontSize:12,color:"#567161"}}>{ROLE_LABELS[account?.role||""]||account?.role}</div>
     <button type="button" onClick={()=>void logout()} disabled={loggingOut}
       style={{marginTop:9,padding:"10px 14px",width:"100%",background:"#fff",color:"#20543a",
         border:"1px solid #aac7b3",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer"}}>
       {loggingOut?"Kijelentkezés…":"Kijelentkezés"}
     </button>
     {error&&<p role="alert" style={{color:"#b42318",fontSize:12}}>{error}</p>}
   </aside>
 </>;
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f7f5",fontFamily:"system-ui,Arial"}}>
  <section style={{padding:32,border:"1px solid #dce8df",background:"white",borderRadius:16,width:"min(420px,90vw)"}}>
  <h1 style={{marginTop:0,color:"#124731"}}>Kastélydomb admin</h1>
  <p>V1.3 · Integrációs teszt folyamatban</p>
  <label>Felhasználónév (a régi szuperadmin belépéshez hagyd üresen)<input type="text" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} style={{display:"block",width:"100%",padding:12,margin:"12px 0",boxSizing:"border-box"}}/></label>
  <label>Jelszó<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void login()}} style={{display:"block",width:"100%",padding:12,margin:"12px 0",boxSizing:"border-box"}}/></label>
  <button disabled={busy||!password} onClick={()=>void login()} style={{padding:"11px 22px",background:"#196b49",color:"white",border:0,borderRadius:9,cursor:"pointer"}}>Belépés</button>
  {error&&<p role="alert" style={{color:"#b33"}}>{error}</p>}</section></main>;
}
