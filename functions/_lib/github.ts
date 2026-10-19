// Startet den Workflow garmin-sync über die GitHub-API (Sync-Knopf und stündlicher Zeitplan).

const REPO = "jduscher-netizen/sub330";
const WORKFLOW = "garmin-sync.yml";

export type DispatchResult = { ok: true } | { ok: false; status: number; message: string };

export async function dispatchGarminSync(token: string): Promise<DispatchResult> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sub330-app",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (res.ok) return { ok: true };
  const message = res.status === 401 || res.status === 403 || res.status === 404
    ? "GitHub lehnt den Token ab. Prüfe GH_ACTIONS_TOKEN (Actions: Lesen und Schreiben)."
    : `GitHub antwortet mit Fehler ${res.status}.`;
  return { ok: false, status: res.status, message };
}

/** Läuft gerade ein Sync, der vor weniger als 5 Minuten gestartet ist? */
export async function syncRunning(db: D1Database): Promise<boolean> {
  const row = await db.prepare(
    "SELECT id FROM sync_log WHERE source = 'garmin' AND finished_at IS NULL AND started_at > datetime('now', '-5 minutes') LIMIT 1",
  ).first();
  return Boolean(row);
}
