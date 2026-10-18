import { json, type Env } from "../../_lib/types";

// Zwei-Faktor-Code von Garmin entgegennehmen. Der Workflow garmin-login liest ihn
// über die D1-API und schließt damit die Anmeldung ab.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  if (!/^\d{4,8}$/.test(code)) return json({ ok: false, message: "Der Code besteht aus Ziffern, meist sechs." }, 400);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM garmin_mfa WHERE created_at < datetime('now', '-15 minutes')"),
    env.DB.prepare("INSERT INTO garmin_mfa (code) VALUES (?)").bind(code),
  ]);
  return json({ ok: true });
};
