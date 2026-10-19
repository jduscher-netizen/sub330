import { dispatchGarminSync, syncRunning } from "../functions/_lib/github";

// Stündlicher Zeitplan für den Garmin-Sync (Cloudflare Cron Trigger).
// GitHub startet zeitgesteuerte Workflows unzuverlässig, deshalb stößt dieser Worker
// den Workflow garmin-sync an, so wie der Sync-Knopf. Fehler landen im Sync-Protokoll.

interface CronEnv {
  DB: D1Database;
  GH_ACTIONS_TOKEN?: string;
}

const FIRST_HOUR = 6;
const LAST_HOUR = 22;

function berlinHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" }).format(date));
}

async function logFailure(db: D1Database, message: string) {
  await db.prepare(
    "INSERT INTO sync_log (source, started_at, finished_at, ok, message) VALUES ('garmin', datetime('now'), datetime('now'), 0, ?)",
  ).bind(`Zeitplan konnte den Sync nicht starten: ${message}`).run();
}

export default {
  async scheduled(controller: ScheduledController, env: CronEnv): Promise<void> {
    const hour = berlinHour(new Date(controller.scheduledTime));
    if (hour < FIRST_HOUR || hour > LAST_HOUR) return; // Cron läuft in UTC, Sommer- und Winterzeit abfangen
    if (!env.GH_ACTIONS_TOKEN) return logFailure(env.DB, "GitHub-Secret GH_ACTIONS_TOKEN fehlt.");
    if (await syncRunning(env.DB)) return;
    try {
      const res = await dispatchGarminSync(env.GH_ACTIONS_TOKEN);
      if (!res.ok) await logFailure(env.DB, res.message);
    } catch (e) {
      await logFailure(env.DB, e instanceof Error ? e.message : "Netzwerkfehler");
    }
  },
} satisfies ExportedHandler<CronEnv>;
