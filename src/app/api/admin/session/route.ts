import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import {
  COOKIE,
  authorized,
  body,
  configError,
  db,
  hash,
  json,
  passwordValid,
  rpc,
  sameOrigin,
} from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const c = configError();
    if (c) return c;
    return json({ authenticated: await authorized(req) });
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
    if (typeof p.password !== "string" || !passwordValid(p.password))
      return json({ error: "Hibás adminjelszó." }, 401);
    const token = randomBytes(32).toString("hex");
    const r = await db("kastelydomb_admin_sessions", {
      method: "POST",
      body: JSON.stringify({
        token_hash: hash(token),
        expires_at: new Date(Date.now() + 8 * 3600000).toISOString(),
      }),
    });
    if (!r.ok) return json({ error: "A munkamenet nem hozható létre." }, 503);
    const response = json({ authenticated: true });
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
