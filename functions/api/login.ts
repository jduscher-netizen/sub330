import { createSessionCookie, passwordMatches } from "../_lib/session";
import { json, type Env } from "../_lib/types";

const WINDOW_MIN = 15;
const MAX_FAILS = 8;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.APP_PASSWORD) return json({ ok: false, message: "Der Login ist noch nicht eingerichtet." }, 503);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unbekannt";
  const fails = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND created_at > datetime('now', '-${WINDOW_MIN} minutes')`,
  ).bind(ip).first<{ n: number }>();
  if ((fails?.n ?? 0) >= MAX_FAILS) {
    return json({ ok: false, message: `Zu viele Versuche. Bitte in ${WINDOW_MIN} Minuten erneut.` }, 429);
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (typeof body.password !== "string" || !(await passwordMatches(body.password, env))) {
    await env.DB.prepare("INSERT INTO login_attempts (ip) VALUES (?)").bind(ip).run();
    return json({ ok: false, message: "Passwort stimmt nicht." }, 401);
  }

  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ? OR created_at < datetime('now', '-1 day')").bind(ip).run();
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", await createSessionCookie(env));
  return res;
};
