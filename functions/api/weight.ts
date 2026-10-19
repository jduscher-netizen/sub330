import { isIsoDate, json, todayBerlin, type Env } from "../_lib/types";

// Gewicht von Hand eintragen (Waage ohne Garmin-Anbindung). Landet in daily_metrics wie der Garmin-Wert;
// der Sync überschreibt es nur, wenn Garmin für den Tag selbst ein Gewicht hat.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { date?: unknown; kg?: unknown };
  const date = typeof body.date === "string" && isIsoDate(body.date) ? body.date : todayBerlin();
  const kg = Number(String(body.kg ?? "").replace(",", "."));
  if (!Number.isFinite(kg) || kg < 30 || kg > 250) return json({ ok: false, message: "Bitte ein Gewicht zwischen 30 und 250 kg eintragen." }, 400);
  await env.DB.prepare(
    `INSERT INTO daily_metrics (date, weight_kg) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, updated_at = datetime('now')`,
  ).bind(date, Math.round(kg * 10) / 10).run();
  return json({ ok: true });
};
