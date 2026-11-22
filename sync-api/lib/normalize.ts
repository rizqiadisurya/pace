/**
 * Normalisasi data Garmin / Strava ke bentuk yang dipahami Pace.
 * Fungsi murni tanpa IO supaya mudah dites.
 */

export interface SyncedActivity {
  source: "GARMIN" | "STRAVA";
  externalId: string;
  /** Tanggal lokal YYYY-MM-DD */
  date: string;
  /** Waktu mulai lokal "YYYY-MM-DDTHH:mm:ss" (untuk deteksi duplikat lintas sumber) */
  startLocal: string;
  name: string | null;
  distanceKm: number;
  /** Durasi bergerak (detik) */
  durationSec: number;
  avgHr: number | null;
  maxHr: number | null;
  trainingLoad: number | null;
  aerobicTE: number | null;
}

export interface SyncedSignal {
  date: string;
  sleepHours: number | null;
  sleepScore: number | null;
  hrvLastNight: number | null;
  hrvBaseline: number | null;
  /** Selisih HRV semalam terhadap baseline, dalam persen */
  hrvDeltaPct: number | null;
  hrvStatus: string | null;
  bodyBatteryCharged: number | null;
}

export interface SyncResult {
  source: "GARMIN" | "STRAVA";
  fetchedAt: string;
  activities: SyncedActivity[];
  signals: SyncedSignal[];
  /** Zona HR dari Garmin (bpm batas atas zona 1–5), bila tersedia */
  hrZones?: number[] | null;
  /** Hanya Strava: refresh token terbaru untuk disimpan klien */
  refreshToken?: string;
  warnings: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const RUN_KEYS = /run|treadmill|track|trail|ultra|virtual_run/i;

// ---------- Garmin ----------

interface GarminActivity {
  activityId?: number;
  activityName?: string;
  activityType?: { typeKey?: string; parentTypeId?: number };
  startTimeLocal?: string; // "2026-11-20 05:42:10"
  distance?: number; // meter
  duration?: number;
  movingDuration?: number;
  averageHR?: number;
  maxHR?: number;
  activityTrainingLoad?: number;
  aerobicTrainingEffect?: number;
}

export function normalizeGarminActivities(list: unknown): SyncedActivity[] {
  if (!Array.isArray(list)) return [];
  return (list as GarminActivity[])
    .filter((a) => a && a.activityId != null && RUN_KEYS.test(a.activityType?.typeKey ?? "") && (a.distance ?? 0) > 300)
    .map((a) => {
      const startLocal = (a.startTimeLocal ?? "").replace(" ", "T").slice(0, 19);
      return {
        source: "GARMIN" as const,
        externalId: String(a.activityId),
        date: startLocal.slice(0, 10),
        startLocal,
        name: a.activityName ?? null,
        distanceKm: round1((a.distance ?? 0) / 1000),
        durationSec: Math.round(num(a.movingDuration) ?? num(a.duration) ?? 0),
        avgHr: num(a.averageHR) !== null ? Math.round(a.averageHR!) : null,
        maxHr: num(a.maxHR) !== null ? Math.round(a.maxHR!) : null,
        trainingLoad: num(a.activityTrainingLoad) !== null ? Math.round(a.activityTrainingLoad!) : null,
        aerobicTE: num(a.aerobicTrainingEffect) !== null ? round1(a.aerobicTrainingEffect!) : null,
      };
    })
    .filter((a) => a.date.length === 10 && a.durationSec > 0);
}

interface GarminSleep {
  calendarDate?: string;
  sleepTimeSeconds?: number;
  sleepScores?: { overall?: { value?: number } } & Record<string, unknown>;
}
interface GarminHrvSummary {
  calendarDate?: string;
  lastNightAvg?: number;
  weeklyAvg?: number;
  status?: string;
  baseline?: { balancedLow?: number; balancedUpper?: number };
}
interface GarminBodyBattery {
  date?: string;
  charged?: number;
}

/** Gabungkan tidur, HRV, dan Body Battery per tanggal. */
export function normalizeGarminSignals(sleep: unknown, hrv: unknown, bodyBattery: unknown): SyncedSignal[] {
  const byDate = new Map<string, SyncedSignal>();
  const get = (date: string) => {
    let s = byDate.get(date);
    if (!s) {
      s = { date, sleepHours: null, sleepScore: null, hrvLastNight: null, hrvBaseline: null, hrvDeltaPct: null, hrvStatus: null, bodyBatteryCharged: null };
      byDate.set(date, s);
    }
    return s;
  };

  const sleepList: GarminSleep[] = Array.isArray(sleep) ? sleep : sleep && typeof sleep === "object" ? [sleep as GarminSleep] : [];
  for (const sl of sleepList) {
    if (!sl?.calendarDate || !sl.sleepTimeSeconds) continue;
    const s = get(sl.calendarDate);
    s.sleepHours = round1(sl.sleepTimeSeconds / 3600);
    s.sleepScore = num(sl.sleepScores?.overall?.value);
  }

  const hrvList: GarminHrvSummary[] =
    hrv && typeof hrv === "object" && Array.isArray((hrv as { hrvSummaries?: unknown }).hrvSummaries)
      ? (hrv as { hrvSummaries: GarminHrvSummary[] }).hrvSummaries
      : Array.isArray(hrv)
        ? (hrv as GarminHrvSummary[])
        : [];
  for (const h of hrvList) {
    if (!h?.calendarDate || num(h.lastNightAvg) === null) continue;
    const s = get(h.calendarDate);
    s.hrvLastNight = h.lastNightAvg!;
    const lo = num(h.baseline?.balancedLow);
    const hi = num(h.baseline?.balancedUpper);
    const base = lo !== null && hi !== null ? (lo + hi) / 2 : num(h.weeklyAvg);
    s.hrvBaseline = base !== null ? round1(base) : null;
    s.hrvDeltaPct = base ? Math.round(((h.lastNightAvg! - base) / base) * 100) : null;
    s.hrvStatus = h.status ?? null;
  }

  const bbList: GarminBodyBattery[] = Array.isArray(bodyBattery) ? bodyBattery : [];
  for (const b of bbList) {
    if (!b?.date || num(b.charged) === null) continue;
    get(b.date).bodyBatteryCharged = b.charged!;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Zona HR Garmin → batas atas zona 1..5 (bpm). Respons bisa berupa array per sport. */
export function normalizeGarminHrZones(raw: unknown): number[] | null {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const pick =
    (list as Record<string, unknown>[]).find((z) => /run/i.test(String(z.sport ?? ""))) ??
    (list as Record<string, unknown>[]).find((z) => /default/i.test(String(z.sport ?? ""))) ??
    (list[0] as Record<string, unknown> | undefined);
  if (!pick) return null;
  const keys = ["zone2Floor", "zone3Floor", "zone4Floor", "zone5Floor", "maxHeartRateUsed"];
  const vals = keys.map((k) => num(pick[k]));
  if (vals.some((v) => v === null)) return null;
  // batas atas Z1 = floor Z2, ..., batas atas Z5 = HR maks
  return vals as number[];
}

// ---------- Strava ----------

interface StravaActivity {
  id?: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date_local?: string; // "2026-11-20T05:42:10Z" (waktu lokal ditandai Z)
  distance?: number;
  moving_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
}

export function normalizeStravaActivities(list: unknown): SyncedActivity[] {
  if (!Array.isArray(list)) return [];
  return (list as StravaActivity[])
    .filter((a) => a && a.id != null && /Run/.test(a.sport_type ?? a.type ?? "") && (a.distance ?? 0) > 300)
    .map((a) => {
      const startLocal = (a.start_date_local ?? "").replace("Z", "").slice(0, 19);
      return {
        source: "STRAVA" as const,
        externalId: String(a.id),
        date: startLocal.slice(0, 10),
        startLocal,
        name: a.name ?? null,
        distanceKm: round1((a.distance ?? 0) / 1000),
        durationSec: Math.round(a.moving_time ?? 0),
        avgHr: num(a.average_heartrate) !== null ? Math.round(a.average_heartrate!) : null,
        maxHr: num(a.max_heartrate) !== null ? Math.round(a.max_heartrate!) : null,
        trainingLoad: null,
        aerobicTE: null,
      };
    })
    .filter((a) => a.date.length === 10 && a.durationSec > 0);
}

/** Ambil access token dari respons token (format nama field bervariasi). */
export function pickAccessToken(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" && body.length > 20 ? body : null;
  const b = body as Record<string, unknown>;
  for (const k of ["access_token", "accessToken", "token"]) if (typeof b[k] === "string") return b[k] as string;
  return null;
}
