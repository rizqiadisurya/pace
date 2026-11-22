import { env, json, preflight, requireKey } from "../lib/http";
import { stravaConfigured } from "../lib/strava";

export const OPTIONS = preflight;

/** Cek koneksi & sumber yang aktif (butuh kata sandi). */
export async function GET(req: Request) {
  const denied = requireKey(req);
  if (denied) return denied;
  return json(req, { ok: true, garmin: !!env("GARMIN_API_KEY"), strava: stravaConfigured() });
}
