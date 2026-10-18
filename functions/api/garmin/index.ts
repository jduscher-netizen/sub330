import { json, type Env } from "../../_lib/types";

// Status der Garmin-Verbindung: Tokens vorhanden, letzter Login-Versuch und Sync-Protokoll.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [auth, login, log] = await Promise.all([
    env.DB.prepare("SELECT updated_at FROM garmin_auth WHERE id = 1").first<{ updated_at: string }>(),
    env.DB.prepare(
      "SELECT started_at, finished_at, ok, message FROM sync_log WHERE source = 'garmin_login' ORDER BY id DESC LIMIT 1",
    ).first(),
    env.DB.prepare(
      "SELECT id, started_at, finished_at, ok, message FROM sync_log WHERE source = 'garmin' ORDER BY id DESC LIMIT 10",
    ).all(),
  ]);
  return json({ connected: Boolean(auth), tokens_updated_at: auth?.updated_at ?? null, login, log: log.results });
};
