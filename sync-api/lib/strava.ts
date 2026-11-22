import { env } from "./http.js";
import { normalizeStravaActivities, type SyncResult } from "./normalize.js";

/**
 * Strava OAuth 2.0 (https://developers.strava.com/docs/authentication/).
 * Server tidak menyimpan token: refresh token disimpan di perangkat pengguna dan dikirim saat sinkron.
 * Catatan kebijakan: data Strava tidak boleh dipakai untuk aplikasi AI/LLM; analisis Pace berbasis aturan.
 */
const API = () => env("STRAVA_API_BASE") || "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";

export function stravaConfigured() {
  return !!(env("STRAVA_CLIENT_ID") && env("STRAVA_CLIENT_SECRET"));
}

export function authorizeUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: env("STRAVA_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state,
  });
  return `${OAUTH}/authorize?${p}`;
}

interface TokenBody {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string };
}

async function token(params: Record<string, string>): Promise<TokenBody> {
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("STRAVA_CLIENT_ID"), client_secret: env("STRAVA_CLIENT_SECRET"), ...params }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}`);
  return (await res.json()) as TokenBody;
}

export const exchangeCode = (code: string) => token({ code, grant_type: "authorization_code" });

export async function syncStrava(refreshToken: string, from: string, to: string): Promise<SyncResult> {
  const t = await token({ refresh_token: refreshToken, grant_type: "refresh_token" });
  const after = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000) - 86400;
  const before = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000) + 86400;
  const res = await fetch(`${API()}/athlete/activities?after=${after}&before=${before}&per_page=100`, {
    headers: { Authorization: `Bearer ${t.access_token}` },
  });
  if (!res.ok) throw new Error(`Strava API ${res.status}`);
  const activities = normalizeStravaActivities(await res.json()).filter((a) => a.date >= from && a.date <= to);
  return { source: "STRAVA", fetchedAt: new Date().toISOString(), activities, signals: [], refreshToken: t.refresh_token, warnings: [] };
}
