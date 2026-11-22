import { ISO, addDaysIso, json, preflight, readJson, requireKey } from "../../lib/http.js";
import { syncGarmin } from "../../lib/garmin.js";

export const OPTIONS = preflight;

/** POST { from, to } → lari, tidur, HRV, Body Battery, zona HR dari Garmin. */
export async function POST(req: Request) {
  const denied = requireKey(req);
  if (denied) return denied;
  const b = await readJson<{ from: string; to: string }>(req);
  const to = ISO.test(b.to ?? "") ? b.to! : new Date().toISOString().slice(0, 10);
  let from = ISO.test(b.from ?? "") ? b.from! : addDaysIso(to, -13);
  if (from < addDaysIso(to, -30)) from = addDaysIso(to, -30); // batas API: 31 hari
  try {
    return json(req, await syncGarmin(from, to));
  } catch (e) {
    return json(req, { error: (e as Error).message }, 502);
  }
}
