import { addDays, diffDays, weekStart, type ISODate } from "./dates";
import {
  formatKm,
  formatPace,
  type GoalType,
  type NewWorkout,
  type PaceProfile,
  type Phase,
  type WorkoutType,
} from "./types";

export interface PlanInput {
  startDate: ISODate;
  goalType: GoalType;
  raceDate?: ISODate | null;
  easyPaceSec: number;
  targetPaceSec?: number | null;
  baseWeeklyKm: number;
  weeksOff: number;
  /** 0 = Senin ... 6 = Minggu */
  availableDays: number[];
  longRunDay: number;
}

const PEAK_KM: Record<GoalType, number> = { "10K": 35, HM: 45, FM: 60, RETURN: 0 };
const LONG_CAP_KM: Record<GoalType, number> = { "10K": 14, HM: 20, FM: 32, RETURN: 12 };

export const round05 = (x: number) => Math.round(x * 2) / 2;

export function pacesFor(input: Pick<PlanInput, "easyPaceSec" | "targetPaceSec">): PaceProfile {
  const easy = input.easyPaceSec;
  const tempo = Math.max(180, input.targetPaceSec ? Math.min(input.targetPaceSec - 10, easy - 30) : easy - 60);
  return { easyPaceSec: easy, tempoPaceSec: tempo, intervalPaceSec: Math.max(170, tempo - 20) };
}

export function comebackWeeks(weeksOff: number): number {
  if (weeksOff >= 12) return 3;
  if (weeksOff >= 4) return 2;
  return 0;
}

export function totalWeeks(input: PlanInput): number {
  if (input.raceDate) {
    const n = Math.floor(diffDays(input.raceDate, weekStart(input.startDate)) / 7) + 1;
    return Math.min(20, Math.max(4, n));
  }
  return input.goalType === "RETURN" ? 8 : 12;
}

export function phasesFor(input: PlanInput, n: number): Phase[] {
  const cb = Math.min(comebackWeeks(input.weeksOff), Math.max(0, n - 2));
  if (input.goalType === "RETURN") {
    return Array.from({ length: n }, (_, i) => (i < cb ? "COMEBACK" : "BASE"));
  }
  const taper = input.goalType === "10K" || n < 6 ? 1 : 2;
  const rest = Math.max(0, n - cb - taper);
  const peak = Math.round(rest * 0.25);
  const build = Math.round(rest * 0.35);
  const base = rest - peak - build;
  return [
    ...Array<Phase>(cb).fill("COMEBACK"),
    ...Array<Phase>(base).fill("BASE"),
    ...Array<Phase>(build).fill("BUILD"),
    ...Array<Phase>(peak).fill("PEAK"),
    ...Array<Phase>(taper).fill("TAPER"),
  ];
}

/** Volume mingguan: naik maks 10% dari minggu non-cutback terakhir, cutback tiap minggu ke-4. */
export function weeklyVolumes(input: PlanInput, phases: Phase[]): number[] {
  const start = input.weeksOff >= 4 ? Math.max(6, input.baseWeeklyKm * 0.5) : Math.max(8, input.baseWeeklyKm);
  const peak = Math.max(start, input.goalType === "RETURN" ? start * 1.6 : PEAK_KM[input.goalType]);
  const vols: number[] = [];
  let lastFull = start;
  let maxReached = start;
  let taperIdx = 0;
  phases.forEach((phase, i) => {
    let v: number;
    if (i === 0) v = start;
    else if (phase === "TAPER") {
      const factors = phases.filter((p) => p === "TAPER").length === 1 ? [0.65] : [0.7, 0.55];
      v = maxReached * factors[taperIdx++];
    } else if ((i + 1) % 4 === 0 && phase !== "COMEBACK") {
      v = lastFull * 0.75;
    } else {
      v = Math.min(peak, lastFull * 1.1);
      lastFull = v;
    }
    if (phase !== "TAPER") maxReached = Math.max(maxReached, v);
    vols.push(round05(v));
  });
  return vols;
}

function qualityCount(phase: Phase, runDays: number): number {
  if (runDays < 3) return 0;
  switch (phase) {
    case "BUILD":
    case "TAPER":
      return 1;
    case "PEAK":
      return runDays >= 4 ? 2 : 1;
    default:
      return 0;
  }
}

/** Pilih hari kualitas: tidak bersebelahan satu sama lain maupun dengan long run. */
export function pickQualityDays(runDays: number[], longDay: number | null, count: number): number[] {
  const pref = [1, 2, 3, 0, 4, 5, 6];
  const chosen: number[] = [];
  const hard = longDay === null ? [] : [longDay];
  for (const d of pref) {
    if (chosen.length >= count) break;
    if (!runDays.includes(d) || d === longDay) continue;
    if ([...hard, ...chosen].some((h) => Math.abs(h - d) < 2)) continue;
    chosen.push(d);
  }
  return chosen.sort((a, b) => a - b);
}

/** Pilih subset hari lari yang tersebar (hindari hari berurutan bila bisa), long run selalu ikut. */
export function selectRunDays(avail: number[], longDay: number | null, max: number): number[] {
  if (avail.length <= max) return avail;
  const chosen = longDay === null ? [] : [longDay];
  const pref = [1, 3, 5, 0, 2, 4, 6].filter((d) => avail.includes(d) && d !== longDay);
  for (const strict of [true, false]) {
    for (const d of pref) {
      if (chosen.length >= max) break;
      if (chosen.includes(d)) continue;
      if (strict && chosen.some((c) => Math.abs(c - d) < 2)) continue;
      chosen.push(d);
    }
  }
  return chosen.sort((a, b) => a - b);
}

export function describe(type: WorkoutType, km: number, p: PaceProfile): string {
  const easy = `${formatPace(p.easyPaceSec)}–${formatPace(p.easyPaceSec + 30)}/km`;
  switch (type) {
    case "EASY":
      return `Lari santai di ${easy}, zona 2. Harus masih bisa ngobrol.`;
    case "STRIDES":
      return `Easy ${formatKm(km)} km di ${easy}, lalu 4–6 × 20 detik strides (cepat tapi rileks), jalan kaki di antaranya.`;
    case "TEMPO":
      return `Pemanasan 1,5 km, ${formatKm(Math.max(1, km - 3))} km di ${formatPace(p.tempoPaceSec)}/km, pendinginan 1,5 km.`;
    case "INTERVAL": {
      const reps = Math.min(10, Math.max(4, Math.round(((km - 3) * 1000) / 600)));
      return `Pemanasan 1,5 km, ${reps} × 400 m di ${formatPace(p.intervalPaceSec)}/km dengan jog 200 m, pendinginan 1,5 km.`;
    }
    case "LONG":
      return `Lari panjang santai di ${formatPace(p.easyPaceSec + 15)}–${formatPace(p.easyPaceSec + 45)}/km. Bawa minum.`;
    case "MOBILITY":
      return "Mobility dan stretching 20 menit. Fokus pinggul, betis, dan hamstring.";
    case "REST":
      return "Istirahat total atau jalan santai. Tubuh membangun kekuatan saat pulih.";
  }
}

export function buildWeek(
  input: PlanInput,
  weekIndex: number,
  phase: Phase,
  volume: number,
  monday: ISODate,
  paces: PaceProfile,
): NewWorkout[] {
  const avail = [...new Set(input.availableDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const longDay =
    avail.length >= 2 ? (avail.includes(input.longRunDay) ? input.longRunDay : avail[avail.length - 1]) : null;
  // Volume kecil (mis. comeback) → lebih sedikit hari lari, supaya tiap sesi tetap >= 3 km.
  const maxRuns = Math.max(2, Math.min(6, Math.floor(volume / 3.5)));
  const runDays = selectRunDays(avail, longDay, maxRuns);
  const qDays = pickQualityDays(runDays, longDay, qualityCount(phase, runDays.length));
  const qTypes: WorkoutType[] = qDays.length === 2 ? ["INTERVAL", "TEMPO"] : phase === "PEAK" ? ["INTERVAL"] : ["TEMPO"];

  const cap = LONG_CAP_KM[input.goalType];
  const longKm = longDay === null ? 0 : round05(Math.min(cap, Math.max(4, volume * (phase === "COMEBACK" ? 0.3 : 0.32))));
  const qKm = qDays.map((_, i) => round05(Math.max(4, volume * (qTypes[i] === "INTERVAL" ? 0.17 : 0.2))));
  const easyDays = runDays.filter((d) => d !== longDay && !qDays.includes(d));
  const remaining = volume - longKm - qKm.reduce((a, b) => a + b, 0);
  const easyKm = easyDays.length ? round05(Math.max(3, remaining / easyDays.length)) : 0;
  const stridesDay = phase === "COMEBACK" || phase === "BASE" ? easyDays[easyDays.length > 1 ? 1 : 0] : undefined;

  const out: NewWorkout[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(monday, d);
    if (date < input.startDate) continue;
    let type: WorkoutType = "REST";
    let km = 0;
    if (d === longDay) {
      type = longKm >= 6 ? "LONG" : "EASY";
      km = longKm;
    } else if (qDays.includes(d)) {
      const i = qDays.indexOf(d);
      type = qTypes[i];
      km = qKm[i];
    } else if (easyDays.includes(d)) {
      type = d === stridesDay ? "STRIDES" : "EASY";
      km = easyKm;
    }
    out.push({ date, week: weekIndex + 1, phase, type, distanceKm: km, description: describe(type, km, paces) });
  }
  return out;
}

export function generatePlan(input: PlanInput): NewWorkout[] {
  const n = totalWeeks(input);
  const phases = phasesFor(input, n);
  const vols = weeklyVolumes(input, phases);
  const paces = pacesFor(input);
  const firstMonday = weekStart(input.startDate);
  return phases.flatMap((phase, i) => buildWeek(input, i, phase, vols[i], addDays(firstMonday, i * 7), paces));
}
