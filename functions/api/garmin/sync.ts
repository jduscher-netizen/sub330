import { dispatchGarminSync, syncRunning } from "../../_lib/github";
import { json, type Env } from "../../_lib/types";

// "Jetzt synchronisieren": startet den Workflow garmin-sync über die GitHub-API.
// Der Sync selbst läuft weiter in GitHub Actions und schreibt wie gewohnt in sync_log.
export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  if (!env.GH_ACTIONS_TOKEN) {
    return json({ ok: false, message: "Der Sync-Knopf ist noch nicht eingerichtet: GitHub-Secret GH_ACTIONS_TOKEN fehlt." }, 503);
  }
  if (await syncRunning(env.DB)) return json({ ok: true, message: "Sync läuft bereits." });

  const res = await dispatchGarminSync(env.GH_ACTIONS_TOKEN);
  if (!res.ok) return json({ ok: false, message: res.message }, 502);
  return json({ ok: true, message: "Sync gestartet." });
};
