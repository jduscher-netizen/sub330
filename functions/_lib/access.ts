import type { Env } from "./types";

// Prüft das von Cloudflare Access ausgestellte JWT (Header Cf-Access-Jwt-Assertion).
// Ohne eingerichteten Zugang bleiben alle Daten-Endpunkte gesperrt.

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }

let certCache: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null;

async function getKeys(domain: string): Promise<Jwk[]> {
  if (certCache && certCache.domain === domain && Date.now() - certCache.fetchedAt < 3600_000) {
    return certCache.keys;
  }
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access-Zertifikate nicht abrufbar (${res.status})`);
  const body = (await res.json()) as { keys: Jwk[] };
  certCache = { domain, keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export type AccessResult = { ok: true; email?: string } | { ok: false; reason: string };

export async function verifyAccess(request: Request, env: Env): Promise<AccessResult> {
  if (env.DEV_NO_AUTH === "1") return { ok: true, email: "lokal" };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return { ok: false, reason: "Zugangsschutz ist noch nicht eingerichtet." };
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, reason: "Nicht angemeldet." };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Ungültige Anmeldung." };
  const [h, p, s] = parts;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { kid: string; alg: string };
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as {
    aud: string | string[]; exp: number; email?: string; iss?: string;
  };
  if (header.alg !== "RS256") return { ok: false, reason: "Ungültige Anmeldung." };

  const keys = await getKeys(env.ACCESS_TEAM_DOMAIN);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: "Unbekannter Schlüssel." };

  const key = await crypto.subtle.importKey(
    "jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) return { ok: false, reason: "Ungültige Signatur." };

  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.ACCESS_AUD)) return { ok: false, reason: "Falsche Anwendung." };
  if (payload.exp * 1000 < Date.now()) return { ok: false, reason: "Anmeldung abgelaufen." };
  if (payload.iss && payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) {
    return { ok: false, reason: "Falscher Aussteller." };
  }
  return { ok: true, email: payload.email };
}
