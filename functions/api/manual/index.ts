import { isIsoDate, json, todayBerlin, type Env } from "../../_lib/types";

// Freie Einheit ohne Garmin-Aufzeichnung abhaken (z. B. Mobility).
const CATEGORIES = new Set(["mobility"]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { category?: unknown; date?: unknown };
  const category = typeof body.category === "string" && CATEGORIES.has(body.category) ? body.category : null;
  if (!category) return json({ ok: false, message: "Unbekannte Einheit." }, 400);
  const date = typeof body.date === "string" && isIsoDate(body.date) ? body.date : todayBerlin();
  if (date > todayBerlin()) return json({ ok: false, message: "Nur heute oder früher abhaken." }, 400);
  const row = await env.DB.prepare("INSERT INTO manual_sessions (date, category) VALUES (?, ?) RETURNING id").bind(date, category).first<{ id: number }>();
  return json({ ok: true, id: row?.id });
};
