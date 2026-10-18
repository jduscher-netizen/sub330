import { verifyAccess } from "../_lib/access";
import { json, type Env } from "../_lib/types";

// Alle /api-Endpunkte außer /api/health sind nur mit gültiger Cloudflare-Access-Anmeldung erreichbar.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (url.pathname === "/api/health") return ctx.next();
  try {
    const res = await verifyAccess(ctx.request, ctx.env);
    if (!res.ok) return json({ error: "unauthorized", message: res.reason }, 401);
  } catch (e) {
    return json({ error: "unauthorized", message: (e as Error).message }, 401);
  }
  return ctx.next();
};
