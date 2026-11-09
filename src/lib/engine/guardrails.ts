import { diffDays } from "./dates";
import { isHard, isQuality, isRun, type Workout } from "./types";

/**
 * Aturan keamanan yang TIDAK boleh dilanggar agent:
 * 1. Sesi kualitas tidak bersebelahan dengan sesi berat lain (kualitas/long run): jarak >= 48 jam.
 * 2. Volume minggu ini tidak naik > 10% dari volume tertinggi 3 minggu sebelumnya (+1 km toleransi pembulatan).
 * 3. Saat ada laporan nyeri berulang, tidak ada sesi kualitas (dicek di decide.ts).
 */
export const MAX_WEEKLY_INCREASE = 0.1;
export const MIN_HARD_GAP_DAYS = 2;

export type Violation =
  | { rule: "HARD_SPACING"; dates: [string, string] }
  | { rule: "VOLUME_JUMP"; week: number; km: number; limit: number };

const active = (w: Workout) => w.status === "PLANNED" || w.status === "DONE";

export function weekKm(week: Workout[]): number {
  return week.filter((w) => active(w) && isRun(w.type)).reduce((s, w) => s + w.distanceKm, 0);
}

export function spacingViolations(week: Workout[]): Violation[] {
  const hard = week.filter((w) => active(w) && isHard(w.type)).sort((a, b) => a.date.localeCompare(b.date));
  const out: Violation[] = [];
  for (let i = 0; i < hard.length; i++) {
    for (let j = i + 1; j < hard.length; j++) {
      const a = hard[i];
      const b = hard[j];
      // Dua sesi berat berdekatan hanya dilarang jika salah satunya sesi kualitas.
      if (!isQuality(a.type) && !isQuality(b.type)) continue;
      if (Math.abs(diffDays(b.date, a.date)) < MIN_HARD_GAP_DAYS) out.push({ rule: "HARD_SPACING", dates: [a.date, b.date] });
    }
  }
  return out;
}

export function volumeViolation(weekNo: number, km: number, previousWeeksKm: number[]): Violation | null {
  const ref = Math.max(0, ...previousWeeksKm.slice(-3));
  if (ref === 0) return null;
  const limit = ref * (1 + MAX_WEEKLY_INCREASE) + 1;
  return km > limit ? { rule: "VOLUME_JUMP", week: weekNo, km, limit } : null;
}

export function validateWeek(week: Workout[], previousWeeksKm: number[] = []): Violation[] {
  const v = spacingViolations(week);
  const vol = volumeViolation(week[0]?.week ?? 0, weekKm(week), previousWeeksKm);
  return vol ? [...v, vol] : v;
}
