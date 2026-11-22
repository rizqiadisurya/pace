import { ISO, addDaysIso, json, preflight, readJson, requireKey } from "../../lib/http";
import { stravaConfigured, syncStrava } from "../../lib/strava";

export const OPTIONS = preflight;

/** POST { refreshToken, from, to } → lari dari Strava + refresh token baru. */
export async function POST(req: Request) {
  const denied = requireKey(req);
  if (denied) return denied;
  if (!stravaConfigured()) return json(req, { error: "Strava belum dikonfigurasi di server." }, 501);
  const b = await readJson<{ refreshToken: string; from: string; to: string }>(req);
  if (!b.refreshToken) return json(req, { error: "Strava belum terhubung." }, 400);
  const to = ISO.test(b.to ?? "") ? b.to! : new Date().toISOString().slice(0, 10);
  const from = ISO.test(b.from ?? "") ? b.from! : addDaysIso(to, -13);
  try {
    return json(req, await syncStrava(b.refreshToken, from, to));
  } catch (e) {
    return json(req, { error: (e as Error).message }, 502);
  }
}
