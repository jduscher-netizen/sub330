import { clearSessionCookie } from "../_lib/session";
import { json, type Env } from "../_lib/types";

export const onRequestPost: PagesFunction<Env> = async () => {
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
};
