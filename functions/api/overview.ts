import { json, type Env } from "../_lib/types";
import { lastSync } from "./today";

// Ziele, Verlauf der Tageswerte und Status der Datenquellen.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [races, history, sync] = await Promise.all([
    env.DB.prepare("SELECT * FROM races ORDER BY COALESCE(date, '9999')").all(),
    env.DB.prepare(
      "SELECT date, vo2max, resting_hr, hrv_last_night, weight_kg, readiness_score FROM daily_metrics ORDER BY date DESC LIMIT 120",
    ).all(),
    lastSync(env),
  ]);
  return json({ races: races.results, history: history.results.reverse(), sync });
};
