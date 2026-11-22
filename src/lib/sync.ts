"use client";
/**
 * Klien sinkronisasi Pace ↔ sync-api (Vercel) ↔ Garmin / Strava.
 * Konfigurasi (alamat API, kata sandi, refresh token Strava) disimpan terpisah dari data latihan
 * dan TIDAK ikut "Unduh data", karena berisi rahasia.
 */
import { addDays } from "./engine";
import { importSynced, load, todayOf, type ImportSummary, type SyncBatch } from "./store";

export interface SyncConfig {
  apiUrl: string;
  key: string;
  stravaRefresh: string | null;
  stravaAthlete: string | null;
  garminEnabled: boolean;
  stravaEnabled: boolean;
  lastSyncAt: string | null;
  lastSummary: ImportSummary | null;
  lastError: string | null;
  lastWarnings: string[];
}

const KEY = "pace:sync:v1";
const empty: SyncConfig = {
  apiUrl: "",
  key: "",
  stravaRefresh: null,
  stravaAthlete: null,
  garminEnabled: false,
  stravaEnabled: false,
  lastSyncAt: null,
  lastSummary: null,
  lastError: null,
  lastWarnings: [],
};

let cache: SyncConfig | null = null;
const listeners = new Set<() => void>();

export function getSyncConfig(): SyncConfig {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    cache = raw ? { ...empty, ...(JSON.parse(raw) as SyncConfig) } : empty;
  } catch {
    cache = empty;
  }
  return cache;
}

export function setSyncConfig(patch: Partial<SyncConfig>) {
  cache = { ...getSyncConfig(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* abaikan */
  }
  listeners.forEach((l) => l());
}

export function clearSyncConfig() {
  cache = empty;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
  listeners.forEach((l) => l());
}

export function subscribeSync(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const syncReady = (c: SyncConfig) => !!c.apiUrl && !!c.key && (c.garminEnabled || (c.stravaEnabled && !!c.stravaRefresh));

const base = (c: SyncConfig) => c.apiUrl.replace(/\/+$/, "");

async function call<T>(c: SyncConfig, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base(c)}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-Pace-Key": c.key, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Tidak bisa menghubungi sync API. Cek alamatnya dan koneksi internet.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Sync API error ${res.status}`);
  return data;
}

/** Tes koneksi & sumber yang aktif di server. */
export async function testConnection(apiUrl: string, key: string): Promise<{ garmin: boolean; strava: boolean }> {
  return call({ ...empty, apiUrl, key }, "/api/health");
}

export function stravaConnectUrl(c: SyncConfig) {
  return `${base(c)}/api/strava/authorize`;
}

/** Baca hasil OAuth Strava dari fragmen URL (#strava_refresh=...) setelah kembali ke Pace. */
export function consumeStravaRedirect(): { ok: boolean; message: string } | null {
  if (typeof window === "undefined" || !window.location.hash.includes("strava_")) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  history.replaceState(null, "", window.location.pathname + window.location.search);
  const refresh = params.get("strava_refresh");
  if (refresh) {
    setSyncConfig({ stravaRefresh: refresh, stravaAthlete: params.get("strava_athlete") || null, stravaEnabled: true });
    return { ok: true, message: "Strava terhubung." };
  }
  const err = params.get("strava_error");
  const why: Record<string, string> = {
    access_denied: "Izin Strava dibatalkan.",
    scope: "Izin membaca aktivitas tidak dicentang. Coba lagi dan centang izin aktivitas.",
    state: "Sesi login Strava kedaluwarsa. Coba lagi.",
    exchange: "Strava menolak penukaran token. Cek STRAVA_CLIENT_ID/SECRET di server.",
  };
  return { ok: false, message: why[err ?? ""] ?? "Gagal menghubungkan Strava." };
}

let inflight: Promise<ImportSummary> | null = null;

/** Tarik 14 hari terakhir dari sumber yang aktif lalu masukkan ke store. */
export function syncNow(now?: Date): Promise<ImportSummary> {
  if (inflight) return inflight;
  inflight = (async () => {
    const c = getSyncConfig();
    if (!syncReady(c)) throw new Error("Sinkronisasi belum diatur. Buka Profil → Sinkronisasi.");
    const p = load().profile;
    if (!p) throw new Error("Belum ada profil.");
    const to = todayOf(p, now);
    const from = addDays(to, -13);
    const jobs: Promise<SyncBatch & { refreshToken?: string; warnings?: string[] }>[] = [];
    if (c.garminEnabled) jobs.push(call(c, "/api/garmin/sync", { from, to }));
    if (c.stravaEnabled && c.stravaRefresh) jobs.push(call(c, "/api/strava/sync", { refreshToken: c.stravaRefresh, from, to }));
    const settled = await Promise.allSettled(jobs);
    const ok = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const errors = settled.flatMap((r) => (r.status === "rejected" ? [(r.reason as Error).message] : []));
    const newRefresh = ok.find((b) => b.refreshToken)?.refreshToken;
    if (!ok.length) {
      setSyncConfig({ lastError: errors.join(" · ") || "Sinkron gagal." });
      throw new Error(errors.join(" · ") || "Sinkron gagal.");
    }
    const summary = importSynced(ok, now);
    setSyncConfig({
      lastSyncAt: new Date().toISOString(),
      lastSummary: summary,
      lastError: errors.length ? errors.join(" · ") : null,
      lastWarnings: ok.flatMap((b) => b.warnings ?? []),
      ...(newRefresh ? { stravaRefresh: newRefresh } : {}),
    });
    return summary;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function describeSummary(s: ImportSummary | null): string {
  if (!s) return "";
  const parts: string[] = [];
  if (s.newRuns) parts.push(`${s.newRuns} lari baru`);
  if (s.matchedSessions) parts.push(`${s.matchedSessions} sesi ditandai selesai`);
  if (s.signalsUpdated) parts.push(`${s.signalsUpdated} hari tidur/HRV`);
  if (s.merged) parts.push(`${s.merged} duplikat digabung`);
  return parts.length ? parts.join(" · ") : "Tidak ada data baru";
}
