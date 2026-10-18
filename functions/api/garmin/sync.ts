import { json, type Env } from "../../_lib/types";

const REPO = "jduscher-netizen/sub330";
const WORKFLOW = "garmin-sync.yml";

// "Jetzt synchronisieren": startet den Workflow garmin-sync über die GitHub-API.
// Der Sync selbst läuft weiter in GitHub Actions und schreibt wie gewohnt in sync_log.
export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  if (!env.GH_ACTIONS_TOKEN) {
    return json({ ok: false, message: "Der Sync-Knopf ist noch nicht eingerichtet: GitHub-Secret GH_ACTIONS_TOKEN fehlt." }, 503);
  }

  // Nicht doppelt starten, solange ein Lauf frisch ist.
  const running = await env.DB.prepare(
    "SELECT id FROM sync_log WHERE source = 'garmin' AND finished_at IS NULL AND started_at > datetime('now', '-5 minutes') LIMIT 1",
  ).first();
  if (running) return json({ ok: true, message: "Sync läuft bereits." });

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_ACTIONS_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sub330-app",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 || res.status === 404
      ? "GitHub lehnt den Token ab. Prüfe GH_ACTIONS_TOKEN (Actions: Lesen und Schreiben)."
      : `GitHub antwortet mit Fehler ${res.status}.`;
    return json({ ok: false, message: hint }, 502);
  }
  return json({ ok: true, message: "Sync gestartet." });
};
