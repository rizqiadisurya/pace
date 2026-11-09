import "server-only";
import { and, eq } from "drizzle-orm";
import { activities, getDb, users, workouts, type User } from "@/db";
import { HttpError } from "./errors";

/**
 * Integrasi Strava (OAuth 2.0). Dokumentasi: https://developers.strava.com/docs/authentication/
 * Catatan: cek kebijakan & batas API Strava untuk app komersial sebelum rilis publik.
 */
const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

export const stravaConfigured = () => !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

export function authorizeUrl(state: string): string {
  if (!stravaConfigured()) throw new HttpError(501, "Strava belum dikonfigurasi (STRAVA_CLIENT_ID/SECRET).");
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL ?? "http://localhost:3000"}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new HttpError(502, `Strava token error ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(u: User, code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code" });
  const db = await getDb();
  await db
    .update(users)
    .set({
      stravaAthleteId: t.athlete ? String(t.athlete.id) : null,
      stravaAccessToken: t.access_token,
      stravaRefreshToken: t.refresh_token,
      stravaExpiresAt: t.expires_at,
    })
    .where(eq(users.id, u.id));
}

async function accessToken(u: User): Promise<string> {
  if (!u.stravaRefreshToken) throw new HttpError(400, "Strava belum terhubung.");
  if (u.stravaAccessToken && u.stravaExpiresAt && u.stravaExpiresAt - 60 > Date.now() / 1000) return u.stravaAccessToken;
  const t = await tokenRequest({ refresh_token: u.stravaRefreshToken, grant_type: "refresh_token" });
  const db = await getDb();
  await db
    .update(users)
    .set({ stravaAccessToken: t.access_token, stravaRefreshToken: t.refresh_token, stravaExpiresAt: t.expires_at })
    .where(eq(users.id, u.id));
  return t.access_token;
}

interface StravaActivity {
  id: number;
  sport_type: string;
  start_date_local: string;
  distance: number; // meter
  moving_time: number; // detik
  average_heartrate?: number;
}

/** Tarik lari 14 hari terakhir, simpan sebagai aktivitas, tandai sesi di tanggal yang sama sebagai DONE. */
export async function syncActivities(u: User, days = 14) {
  const token = await accessToken(u);
  const after = Math.floor(Date.now() / 1000) - days * 86400;
  const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new HttpError(502, `Strava API error ${res.status}`);
  const list = ((await res.json()) as StravaActivity[]).filter((a) => /Run/.test(a.sport_type) && a.distance > 500);
  const db = await getDb();
  let imported = 0;
  for (const a of list) {
    const date = a.start_date_local.slice(0, 10);
    const [planned] = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, u.id), eq(workouts.date, date)))
      .limit(1);
    const inserted = await db
      .insert(activities)
      .values({
        userId: u.id,
        date,
        source: "STRAVA",
        externalId: String(a.id),
        distanceKm: Math.round(a.distance / 100) / 10,
        durationSec: a.moving_time,
        avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        workoutId: planned && planned.type !== "REST" ? planned.id : null,
      })
      .onConflictDoNothing()
      .returning({ id: activities.id });
    if (inserted.length > 0) {
      imported++;
      if (planned && planned.type !== "REST" && planned.status === "PLANNED")
        await db.update(workouts).set({ status: "DONE" }).where(eq(workouts.id, planned.id));
    }
  }
  return { imported, seen: list.length };
}
