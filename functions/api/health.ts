import { json, type Env } from "../_lib/types";

// Öffentlicher Lebenszeichen-Check: verrät keine Trainingsdaten.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let db = false;
  try {
    await env.DB.prepare("SELECT 1").first();
    db = true;
  } catch {
    db = false;
  }
  return json({ ok: true, db, login: Boolean(env.APP_PASSWORD) });
};
