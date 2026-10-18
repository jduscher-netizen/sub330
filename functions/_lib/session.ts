import type { Env } from "./types";

// Einfacher Login für genau einen Nutzer: Passwort (Pages-Secret APP_PASSWORD) gegen
// ein signiertes, HttpOnly-Cookie. Der Signaturschlüssel wird aus dem Passwort abgeleitet,
// ein Passwortwechsel meldet also alle Geräte ab.

const COOKIE = "sub330_session";
const MAX_AGE_S = 365 * 24 * 3600;
const enc = new TextEncoder();

async function hmacKey(env: Env): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`sub330-session-v1:${env.APP_PASSWORD}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);

export async function createSessionCookie(env: Env): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const sig = toHex(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(String(exp))));
  return `${COOKIE}=${exp}.${sig}; Path=/; Max-Age=${MAX_AGE_S}; HttpOnly; Secure; SameSite=Strict`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export async function hasValidSession(request: Request, env: Env): Promise<boolean> {
  if (!env.APP_PASSWORD) return false;
  const value = request.headers.get("Cookie")?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(env), fromHex(sig), enc.encode(exp));
}

/** Passwortvergleich ohne Zeit-Leck: beide Seiten erst hashen, dann HMAC-verify. */
export async function passwordMatches(input: string, env: Env): Promise<boolean> {
  if (!env.APP_PASSWORD) return false;
  const key = await hmacKey(env);
  const expected = await crypto.subtle.sign("HMAC", key, enc.encode(env.APP_PASSWORD));
  return crypto.subtle.verify("HMAC", key, expected, enc.encode(input));
}
