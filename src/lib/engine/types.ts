import type { ISODate } from "./dates";

export type WorkoutType = "EASY" | "TEMPO" | "INTERVAL" | "LONG" | "REST" | "STRIDES" | "MOBILITY";
export type Phase = "COMEBACK" | "BASE" | "BUILD" | "PEAK" | "TAPER";
export type WorkoutStatus = "PLANNED" | "DONE" | "SKIPPED" | "DROPPED";
export type GoalType = "10K" | "HM" | "FM" | "RETURN";

export interface Workout {
  id: string;
  date: ISODate;
  week: number;
  phase: Phase;
  type: WorkoutType;
  distanceKm: number;
  description: string;
  status: WorkoutStatus;
  originalDate?: ISODate | null;
  originalType?: WorkoutType | null;
}

export type NewWorkout = Omit<Workout, "id" | "status">;

export const QUALITY_TYPES: WorkoutType[] = ["TEMPO", "INTERVAL"];
export const RUN_TYPES: WorkoutType[] = ["EASY", "TEMPO", "INTERVAL", "LONG", "STRIDES"];

export const isQuality = (t: WorkoutType) => QUALITY_TYPES.includes(t);
export const isRun = (t: WorkoutType) => RUN_TYPES.includes(t);
/** Sesi "berat" = kualitas atau long run; butuh jarak pemulihan. */
export const isHard = (t: WorkoutType) => isQuality(t) || t === "LONG";

export const TYPE_LABEL: Record<WorkoutType, string> = {
  EASY: "Easy run",
  TEMPO: "Tempo run",
  INTERVAL: "Interval",
  LONG: "Long run",
  REST: "Istirahat",
  STRIDES: "Easy + strides",
  MOBILITY: "Mobility",
};

export interface PaceProfile {
  easyPaceSec: number;
  tempoPaceSec: number;
  intervalPaceSec: number;
}

export function formatPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function workoutTitle(w: Pick<Workout, "type" | "distanceKm">): string {
  if (w.type === "REST") return "Istirahat";
  if (w.type === "MOBILITY") return "Mobility 20 menit";
  return `${TYPE_LABEL[w.type]} ${formatKm(w.distanceKm)} km`;
}

export function formatKm(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",");
}
