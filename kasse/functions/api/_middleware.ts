import { hasValidSession } from "../_lib/session";
import { fail, type Env } from "../_lib/util";

const PUBLIC = new Set(["/api/health", "/api/login", "/api/logout"]);

// Alle anderen /api-Endpunkte nur mit gültiger Anmeldung.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { pathname } = new URL(ctx.request.url);
  if (PUBLIC.has(pathname) || ctx.env.DEV_NO_AUTH === "1") return ctx.next();
  if (!ctx.env.KASSE_PASSWORD) return fail("Das Passwort ist noch nicht eingerichtet.", 401);
  if (!(await hasValidSession(ctx.request, ctx.env))) return fail("Bitte anmelden.", 401);
  try {
    return await ctx.next();
  } catch (e) {
    console.error(e);
    return fail("Serverfehler: " + (e instanceof Error ? e.message : String(e)), 500);
  }
};
