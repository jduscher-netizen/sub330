import { json, type Env } from "../../_lib/types";

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, message: "Eintrag nicht gefunden." }, 404);
  await env.DB.prepare("DELETE FROM manual_sessions WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
