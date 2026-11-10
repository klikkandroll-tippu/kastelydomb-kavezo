"use client";
import {useEffect,useState} from "react";

type Account={id:string|null;username:string;full_name:string;role:string};

export default function AdminPage(){
 const [authenticated,setAuthenticated]=useState<boolean|null>(null);
 const [account,setAccount]=useState<Account|null>(null);
 const [password,setPassword]=useState("");
 const [username,setUsername]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);

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


 if(authenticated===null)return <p style={{padding:30}}>Adminfelület betöltése…</p>;
 if(authenticated)return <iframe title="Kastélydomb admin V1.3" allow="camera" src="/api/admin/shell"
     style={{position:"fixed",inset:0,width:"100%",height:"100%",border:0,background:"#f5f7f5"}} />;
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"#f3f6f3",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif",color:"#1c3628"}}>
   <form onSubmit={e=>{e.preventDefault();void login()}} style={{width:"100%",maxWidth:406,boxSizing:"border-box",padding:"40px 34px",border:"1px solid #dae5dc",borderRadius:18,background:"#fff",boxShadow:"0 16px 40px rgba(20,54,35,.07)"}}>
     <div style={{fontFamily:"Georgia,serif",fontSize:42,color:"#1c5439",letterSpacing:"-.04em",lineHeight:1.08}}>Kastélydomb</div>
     <h1 style={{fontSize:19,fontWeight:650,margin:"8px 0 30px"}}>Adminisztráció</h1>
     <label htmlFor="kd-username" style={{display:"block",fontWeight:600,fontSize:14}}>Felhasználónév</label>
     <input id="kd-username" type="text" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",padding:"13px 12px",margin:"8px 0 20px",border:"1px solid #c9d8cd",borderRadius:9,fontSize:16,background:"#fff"}}/>
     <label htmlFor="kd-password" style={{display:"block",fontWeight:600,fontSize:14}}>Jelszó</label>
     <input id="kd-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",padding:"13px 12px",margin:"8px 0 24px",border:"1px solid #c9d8cd",borderRadius:9,fontSize:16,background:"#fff"}}/>
     <button type="submit" disabled={busy||!password} style={{width:"100%",padding:"13px 16px",background:"#206441",color:"#fff",border:0,borderRadius:9,fontSize:15,fontWeight:700,cursor:"pointer",opacity:busy||!password?.7:1}}>{busy?"Belépés…":"Belépés"}</button>
     {error&&<p role="alert" style={{color:"#b42318",fontSize:13,margin:"18px 0 0"}}>{error}</p>}
   </form>
 </main>;
}
