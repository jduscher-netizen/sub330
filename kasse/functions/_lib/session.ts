import type { Env } from "./util";

// Gemeinsamer Login für Jan und Milena, danach signiertes HttpOnly-Cookie für ein Jahr.
// Das Passwort kommt entweder aus dem Pages-Secret KASSE_PASSWORD (hat Vorrang) oder wird
// beim ersten Öffnen in der App festgelegt und als PBKDF2-Hash in `settings` gespeichert.
// Wer gerade bucht (Jan oder Milena), merkt sich das Gerät selbst.

const COOKIE = "kasse_session";
const MAX_AGE_S = 365 * 24 * 3600;
const PBKDF2_ITER = 100_000; // Höchstwert in Workers
const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);

async function setting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/** Ist schon ein Passwort eingerichtet (Secret oder in der App festgelegt)? */
export async function isConfigured(env: Env): Promise<boolean> {
  return !!env.KASSE_PASSWORD || !!(await setting(env, "password_hash"));
}

async function hmacKey(env: Env): Promise<CryptoKey | null> {
  let material: string | null = null;
  if (env.KASSE_PASSWORD) material = `kasse-session-v1:env:${env.KASSE_PASSWORD}`;
  else {
    const k = await setting(env, "session_key");
    if (k) material = `kasse-session-v1:db:${k}`;
  }
  if (!material) return null;
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(material));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionCookie(env: Env): Promise<string> {
  const key = await hmacKey(env);
  if (!key) throw new Error("Kein Passwort eingerichtet");
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const sig = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(String(exp))));
  return `${COOKIE}=${exp}.${sig}; Path=/; Max-Age=${MAX_AGE_S}; HttpOnly; Secure; SameSite=Strict`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export async function hasValidSession(request: Request, env: Env): Promise<boolean> {
  const value = request.headers.get("Cookie")?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  const key = await hmacKey(env);
  return !!key && crypto.subtle.verify("HMAC", key, fromHex(sig), enc.encode(exp));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function passwordMatches(input: string, env: Env): Promise<boolean> {
  if (env.KASSE_PASSWORD) {
    const key = await hmacKey(env);
    if (!key) return false;
    const expected = await crypto.subtle.sign("HMAC", key, enc.encode(env.KASSE_PASSWORD));
    return crypto.subtle.verify("HMAC", key, expected, enc.encode(input));
  }
  const stored = await setting(env, "password_hash");
  if (!stored) return false;
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  return equalBytes(await pbkdf2(input, fromHex(salt), Number(iter)), fromHex(hash));
}

/** Legt das Passwort beim ersten Öffnen fest. false, wenn schon eins existiert. */
export async function setupPassword(env: Env, password: string): Promise<boolean> {
  if (await isConfigured(env)) return false;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITER);
  const sessionKey = toHex(crypto.getRandomValues(new Uint8Array(32)));
  try {
    // INSERT ohne OR: Gleichzeitige Einrichtung scheitert am Primärschlüssel
    await env.DB.batch([
      env.DB.prepare("INSERT INTO settings (key, value) VALUES ('password_hash', ?)").bind(`pbkdf2$${PBKDF2_ITER}$${toHex(salt)}$${toHex(hash)}`),
      env.DB.prepare("INSERT INTO settings (key, value) VALUES ('session_key', ?)").bind(sessionKey),
    ]);
  } catch {
    return false;
  }
  return true;
}
