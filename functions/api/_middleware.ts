import { hasValidSession } from "../_lib/session";
import { json, type Env } from "../_lib/types";

const PUBLIC = new Set(["/api/health", "/api/login", "/api/logout"]);

// Alle anderen /api-Endpunkte nur mit gültiger Anmeldung.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { pathname } = new URL(ctx.request.url);
  if (PUBLIC.has(pathname) || ctx.env.DEV_NO_AUTH === "1") return ctx.next();
  if (!ctx.env.APP_PASSWORD) {
    return json({ error: "unauthorized", message: "Der Login ist noch nicht eingerichtet." }, 401);
  }
  if (!(await hasValidSession(ctx.request, ctx.env))) {
    return json({ error: "unauthorized", message: "Bitte anmelden." }, 401);
  }
  return ctx.next();
};
