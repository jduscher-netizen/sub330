import { json, type Env } from "../_lib/util";

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({ ok: true, passwordSet: !!env.KASSE_PASSWORD });
