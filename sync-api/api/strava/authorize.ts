import { json } from "../../lib/http.js";
import { authorizeUrl, stravaConfigured } from "../../lib/strava.js";

/** Arahkan ke halaman izin Strava. Callback kembali ke /api/strava/callback di server ini. */
export async function GET(req: Request) {
  if (!stravaConfigured()) return json(req, { error: "STRAVA_CLIENT_ID/SECRET belum di-set." }, 501);
  const self = new URL(req.url);
  const state = crypto.randomUUID();
  const res = new Response(null, { status: 302, headers: { Location: authorizeUrl(`${self.origin}/api/strava/callback`, state) } });
  res.headers.append("Set-Cookie", `strava_state=${state}; Path=/api/strava; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return res;
}
