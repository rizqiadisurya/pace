import { env } from "./http.js";
import { normalizeGarminActivities, normalizeGarminHrZones, normalizeGarminSignals, pickAccessToken, type SyncResult } from "./normalize.js";

/**
 * Garmin Connect Personal API (https://developer.garmin.com/gc-developer-program/personal/).
 * Personal API key → access token (berlaku 24 jam, tanpa refresh token) → panggil endpoint Connect.
 */
const base = () => env("GARMIN_API_BASE") || "https://personal.connectapi.garmin.com";

let cached: { token: string; at: number } | null = null;
const TOKEN_TTL_MS = 20 * 60 * 60 * 1000; // perbarui sebelum 24 jam

export async function garminToken(force = false): Promise<string> {
  const key = env("GARMIN_API_KEY");
  if (!key) throw new Error("GARMIN_API_KEY belum di-set di server.");
  if (!force && cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token;
  const res = await fetch(`${base()}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: "POST",
    headers: { Authorization: `ApiKey ${key}`, Accept: "*/*" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Garmin menolak API key (${res.status}). Cek key belum kedaluwarsa.`);
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* token bisa berupa teks polos */
  }
  const token = pickAccessToken(body);
  if (!token) throw new Error("Respons token Garmin tidak dikenali.");
  cached = { token, at: Date.now() };
  return token;
}

async function get(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json, */*" } });
  if (res.status === 204) return null;
  if (!res.ok) throw Object.assign(new Error(`Garmin ${path.split("?")[0]} → ${res.status}`), { status: res.status });
  return res.json();
}

/** Tarik lari + tidur + HRV + Body Battery untuk rentang tanggal (maks 31 hari). */
export async function syncGarmin(from: string, to: string): Promise<SyncResult> {
  let token = await garminToken();
  const warnings: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      // token kedaluwarsa → coba sekali lagi dengan token baru
      if ((e as { status?: number }).status === 401) {
        token = await garminToken(true);
        try {
          return await fn();
        } catch (e2) {
          warnings.push(`${label}: ${(e2 as Error).message}`);
          return null;
        }
      }
      warnings.push(`${label}: ${(e as Error).message}`);
      return null;
    }
  };

  const q = new URLSearchParams({ startDate: from, endDate: to, activityType: "running", limit: "100", sortOrder: "desc" });
  const [acts, sleep, hrv, bb, zones] = await Promise.all([
    safe("Aktivitas", () => get(`/activitylist-service/activities/search/activities?${q}`, token)),
    safe("Tidur", () => get(`/sleep-service/sleep/dailySleepSummariesByDate?startDate=${from}&endDate=${to}`, token)),
    safe("HRV", () => get(`/hrv-service/hrv/daily/${from}/${to}`, token)),
    safe("Body Battery", () => get(`/wellness-service/wellness/bodyBattery/reports/daily?startDate=${from}&endDate=${to}`, token)),
    safe("Zona HR", () => get(`/biometric-service/heartRateZones/v2`, token)),
  ]);

  return {
    source: "GARMIN",
    fetchedAt: new Date().toISOString(),
    activities: normalizeGarminActivities(acts),
    signals: normalizeGarminSignals(sleep, hrv, bb),
    hrZones: normalizeGarminHrZones(zones),
    warnings,
  };
}
