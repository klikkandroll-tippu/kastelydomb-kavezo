import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
export const COOKIE = "kd_admin_session";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function passwordValid(value: string) {
  const plain = process.env.ADMIN_PASSWORD;
  const expected =
    process.env.ADMIN_PASSWORD_SHA256 ||
    (plain && plain.length >= 16 ? hash(plain) : "");
  return (
    /^[a-f0-9]{64}$/i.test(expected) &&
    timingSafeEqual(
      Buffer.from(hash(value), "hex"),
      Buffer.from(expected, "hex"),
    )
  );
}
export function configError() {
  if (
    (!process.env.ADMIN_PASSWORD_SHA256 &&
      (!process.env.ADMIN_PASSWORD ||
        process.env.ADMIN_PASSWORD.length < 16)) ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return NextResponse.json(
      { error: "Az admin szerveroldali konfigurációja hiányos." },
      { status: 503 },
    );
  return null;
}
export async function db(path: string, options: RequestInit = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(
    process.env.SUPABASE_URL!.replace(/\/$/, "") + "/rest/v1/" + path,
    {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}),
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      },
      cache: "no-store",
    },
  );
}
export async function authorized(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const r = await db(
    "kastelydomb_admin_sessions?token_hash=eq." +
      hash(token) +
      "&expires_at=gt." +
      encodeURIComponent(new Date().toISOString()) +
      "&select=token_hash&limit=1",
  );
  return r.ok && (await r.json()).length === 1;
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return (
    !!origin &&
    origin === req.nextUrl.origin &&
    req.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function guard(req: NextRequest) {
  const config = configError();
  if (config) return config;
  if (req.method !== "GET" && !sameOrigin(req))
    return NextResponse.json(
      { error: "Nem engedélyezett kérésforrás." },
      { status: 403 },
    );
  if (!(await authorized(req)))
    return NextResponse.json(
      { error: "Kérjük, lépjen be újra." },
      { status: 401 },
    );
  return null;
}
export async function body(req: NextRequest, max = 32000) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > max) throw Error("Túl nagy kérés.");
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Hibás adat.");
  return data;
}
export async function rpc(name: string, args: object) {
  const r = await db("rpc/" + name, {
    method: "POST",
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw Error(j.message || "Az adatbázis-művelet sikertelen.");
  }
  return r.json();
}
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
