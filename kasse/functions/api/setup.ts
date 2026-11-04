import { createSessionCookie, setupPassword } from "../_lib/session";
import { fail, json, type Env } from "../_lib/util";

// Einmalig: gemeinsames Passwort festlegen, solange noch keins existiert.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const pw = typeof body.password === "string" ? body.password : "";
  if (pw.length < 8) return fail("Das Passwort braucht mindestens 8 Zeichen.");
  if (pw.length > 200) return fail("Das Passwort ist zu lang.");
  if (!(await setupPassword(env, pw))) return fail("Es gibt schon ein Passwort. Bitte damit anmelden.", 409);
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", await createSessionCookie(env));
  return res;
};
