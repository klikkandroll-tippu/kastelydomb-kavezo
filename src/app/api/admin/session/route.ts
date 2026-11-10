import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import {
  COOKIE,
  sessionAccount,
  body,
  configError,
  db,
  hash,
  json,
  passwordValid,
  rpc,
  sameOrigin,
} from "@/lib/admin-server";
import {safeUsername,verifyPassword} from "@/lib/admin-users";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const c = configError();
    if (c) return c;
    const account=await sessionAccount(req);
    return json({authenticated:!!account,account});
  } catch {
    return json({ error: "Az adatbázis nem érhető el." }, 503);
  }
}
export async function POST(req: NextRequest) {
  const c = configError();
  if (c) return c;
  if (!sameOrigin(req))
    return json({ error: "Nem engedélyezett kérésforrás." }, 403);
  try {
    const p = await body(req, 2000);
    const ip =
      req.headers.get("x-vercel-forwarded-for")?.split(",")[0] || "shared";
    const allowed = await rpc("kd_rate_limit", {
      p_key: hash("login:" + ip),
      p_limit: 10,
      p_seconds: 900,
    });
    if (!allowed)
      return json(
        { error: "Túl sok belépési kísérlet. Próbálja újra 15 perc múlva." },
        429,
      );
    if(typeof p.password!=="string"||p.password.length>128)
      return json({error:"Érvénytelen bejelentkezés."},401);
    const username=typeof p.username==="string"?safeUsername(p.username):"";
    let loginUserId:string|null=null;
    let account:{id:string|null;role:string;username:string;full_name:string}|null=null;
    if(username){
      if(!/^[a-z0-9._-]{3,40}$/.test(username))return json({error:"Hibás felhasználónév vagy jelszó."},401);
      const users=await db("kastelydomb_admin_users?username=eq."+encodeURIComponent(username)+
        "&active=eq.true&select=id,username,full_name,role,password_hash&limit=1");
      if(!users.ok)throw Error("User lookup failed");
      const rows:Array<{id:string;username:string;full_name:string;role:string;password_hash:string}>=await users.json();
      if(rows.length!==1||!verifyPassword(p.password,rows[0].password_hash))
        return json({error:"Hibás felhasználónév vagy jelszó."},401);
      loginUserId=rows[0].id;
      account={id:rows[0].id,role:rows[0].role,username:rows[0].username,full_name:rows[0].full_name};
    }else{
      if(!passwordValid(p.password))return json({error:"Hibás adminjelszó."},401);
      account={id:null,role:"superadmin",username:"szuperadmin",full_name:"Szuperadmin"};
    }
    const token = randomBytes(32).toString("hex");
    const r = await db("kastelydomb_admin_sessions", {
      method: "POST",
      body: JSON.stringify({
        token_hash: hash(token),
        user_id:loginUserId,
        expires_at: new Date(Date.now() + 8 * 3600000).toISOString(),
      }),
    });
    if (!r.ok) return json({ error: "A munkamenet nem hozható létre." }, 503);
    if(loginUserId)void db("kastelydomb_admin_users?id=eq."+encodeURIComponent(loginUserId),{method:"PATCH",body:JSON.stringify({last_login_at:new Date().toISOString()})}).catch(()=>{});
    const response = json({ authenticated: true,account });
    response.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 3600,
    });
    return response;
  } catch {
    return json(
      { error: "A belépés nem érhető el, vagy hibás kérés érkezett." },
      503,
    );
  }
}
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req))
    return json({ error: "Nem engedélyezett kérésforrás." }, 403);
  const token = req.cookies.get(COOKIE)?.value;
  try {
    if (token) {
      const r = await db(
        "kastelydomb_admin_sessions?token_hash=eq." + hash(token),
        { method: "DELETE" },
      );
      if (!r.ok) throw Error();
    }
  } catch {
    return json({ error: "A kijelentkezés nem sikerült. Próbálja újra." }, 503);
  }
  const r = json({ authenticated: false });
  r.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return r;
}
