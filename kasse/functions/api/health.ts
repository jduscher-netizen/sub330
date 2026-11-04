import { isConfigured } from "../_lib/session";
import { json, type Env } from "../_lib/util";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let passwordSet = !!env.KASSE_PASSWORD;
  try { passwordSet = await isConfigured(env); } catch { /* Datenbank noch ohne settings */ }
  return json({ ok: true, passwordSet });
};
