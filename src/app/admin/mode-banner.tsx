"use client";
import { useEffect, useState } from "react";
export default function ModeBanner() {
  const [testMode, setTestMode] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/system-status", {cache:"no-store",signal:controller.signal})
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(s => setTestMode(s.mode !== "production"))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return testMode ? <div role="note" aria-label="Tesztüzem" style={{padding:"12px 18px",background:"#fff1cb",color:"#573c15",borderBottom:"1px solid #d9ba71",textAlign:"center",fontSize:14}}><strong>ÜGYFÉLTESZT</strong> · Minden most rögzített adat tesztadat. A befizetések próbabejegyzések; valódi rendelést ne rögzítsen.</div> : null;
}
