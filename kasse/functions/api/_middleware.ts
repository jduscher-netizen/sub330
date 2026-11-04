import { hasValidSession, isConfigured } from "../_lib/session";
import { fail, type Env } from "../_lib/util";

const PUBLIC = new Set(["/api/health", "/api/login", "/api/logout", "/api/setup"]);

// Alle anderen /api-Endpunkte nur mit gültiger Anmeldung.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { pathname } = new URL(ctx.request.url);
  try {
    if (!PUBLIC.has(pathname) && ctx.env.DEV_NO_AUTH !== "1") {
      if (!(await isConfigured(ctx.env))) return fail("Bitte zuerst ein Passwort festlegen.", 401);
      if (!(await hasValidSession(ctx.request, ctx.env))) return fail("Bitte anmelden.", 401);
    }
    return await ctx.next();
  } catch (e) {
    console.error(e);
    return fail("Serverfehler: " + (e instanceof Error ? e.message : String(e)), 500);
  }
};
