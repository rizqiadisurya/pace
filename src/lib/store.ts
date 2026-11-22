/**
 * Pace local-first store.
 * Semua data tersimpan di perangkat (localStorage). Siklus agent Sense → Decide → Act
 * sama dengan versi server (lihat branch `server-postgres`), memakai engine yang sama.
 */
import {
  LEVEL_LABEL,
  addDays,
  computeReadiness,
  decideToday,
  diffDays,
  formatPace,
  generatePlan,
  pacesFor,
  skipWorkout,
  swapOptions,
  todayInTz,
  weekKm,
  weekStart,
  workoutTitle,
  type GoalType,
  type PlanInput,
  type Readiness,
  type SwapOption,
  type Workout,
} from "./engine";
import type { Feeling } from "./engine/readiness";

export type Autonomy = "AUTO" | "ASK" | "SUGGEST";
export type Pain = "KNEE" | "SHIN_CALF" | "OTHER";

export interface Profile {
  id: string;
  name: string;
  /** Nama event target, mis. "Jakarta Marathon 2027" */
  eventName?: string | null;
  goalType: GoalType;
  raceDate: string | null;
  targetPaceSec: number | null;
  easyPaceSec: number;
  baseWeeklyKm: number;
  weeksOff: number;
  availableDays: number[];
  longRunDay: number;
  autonomy: Autonomy;
  latitude: number;
  longitude: number;
  timezone: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  date: string;
  distanceKm: number;
  durationSec: number;
  avgHr: number | null;
  rpe: number | null;
  pain: Pain | null;
  workoutId: string | null;
  createdAt: string;
}

export interface Signal {
  date: string;
  sleepHours: number | null;
  hrvDeltaPct: number | null;
  feeling: Feeling | null;
}

export interface Adjustment {
  id: string;
  date: string;
  trigger: "DAILY" | "SKIP" | "SWAP";
  reason: string;
  before: Workout[];
  after: Workout[];
  status: "PROPOSED" | "APPLIED" | "REVERTED" | "DISMISSED";
  createdAt: string;
}

export interface State {
  version: 1;
  profile: Profile | null;
  workouts: Workout[];
  activities: Activity[];
  signals: Signal[];
  adjustments: Adjustment[];
}

export class PaceError extends Error {}

const KEY = "pace:v1";
const empty = (): State => ({ version: 1, profile: null, workouts: [], activities: [], signals: [], adjustments: [] });
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();

// ---------- persistence + subscription ----------

interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

let memory: Record<string, string> = {};
const memStorage: Storage = {
  getItem: (k) => memory[k] ?? null,
  setItem: (k, v) => void (memory[k] = v),
  removeItem: (k) => void delete memory[k],
};

function storage(): Storage {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* mode privat / storage diblokir */
  }
  return memStorage;
}

let cache: State | null = null;
const listeners = new Set<() => void>();

export function load(): State {
  if (cache) return cache;
  try {
    const raw = storage().getItem(KEY);
    cache = raw ? { ...empty(), ...(JSON.parse(raw) as State) } : empty();
  } catch {
    cache = empty();
  }
  return cache;
}

function commit(next: State) {
  cache = next;
  try {
    storage().setItem(KEY, JSON.stringify(next));
  } catch {
    /* kuota penuh: tetap jalan di memori */
  }
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Hanya untuk test. */
export function __resetForTests() {
  memory = {};
  cache = null;
}

// ---------- helpers ----------

function requireProfile(s: State): Profile {
  if (!s.profile) throw new PaceError("Belum ada profil. Selesaikan onboarding dulu.");
  return s.profile;
}

export const todayOf = (p: Profile, now?: Date) => todayInTz(p.timezone, now);
export const pacesOf = (p: Profile) => pacesFor({ easyPaceSec: p.easyPaceSec, targetPaceSec: p.targetPaceSec });
const ctxOf = (p: Profile, today: string) => ({ today, availableDays: p.availableDays, paces: pacesOf(p) });

export function weekOf(s: State, date: string): Workout[] {
  const mon = weekStart(date);
  const sun = addDays(mon, 6);
  return s.workouts.filter((w) => w.date >= mon && w.date <= sun).sort((a, b) => a.date.localeCompare(b.date));
}

function withWeek(s: State, week: Workout[]): State {
  const byId = new Map(week.map((w) => [w.id, w]));
  return { ...s, workouts: s.workouts.map((w) => byId.get(w.id) ?? w) };
}

const totalWeeks = (s: State) => s.workouts.reduce((m, w) => Math.max(m, w.week), 0);
const signalOf = (s: State, date: string) => s.signals.find((x) => x.date === date) ?? null;

// ---------- profile & plan ----------

export type ProfileInput = Omit<Profile, "id" | "createdAt" | "latitude" | "longitude" | "timezone"> &
  Partial<Pick<Profile, "latitude" | "longitude" | "timezone">>;

export function validateProfile(i: ProfileInput, today: string): string | null {
  if (!i.name.trim()) return "Nama wajib diisi.";
  if (i.goalType !== "RETURN" && !i.raceDate) return "Tanggal race wajib untuk target race.";
  if (i.raceDate && i.raceDate <= today) return "Tanggal race harus di masa depan.";
  if (i.easyPaceSec < 150 || i.easyPaceSec > 900) return "Pace santai di luar rentang wajar (2:30–15:00/km).";
  if (i.targetPaceSec != null && (i.targetPaceSec < 150 || i.targetPaceSec > 900)) return "Target pace di luar rentang wajar.";
  if (i.baseWeeklyKm < 0 || i.baseWeeklyKm > 200) return "Volume mingguan tidak wajar.";
  if (i.availableDays.length < 2) return "Pilih minimal 2 hari lari.";
  if (!i.availableDays.includes(i.longRunDay)) return "Hari long run harus termasuk hari tersedia.";
  return null;
}

export function createProfile(input: ProfileInput, now?: Date): Profile {
  const timezone = input.timezone ?? "Asia/Jakarta";
  const today = todayInTz(timezone, now);
  const err = validateProfile(input, today);
  if (err) throw new PaceError(err);
  const profile: Profile = {
    ...input,
    id: uid(),
    name: input.name.trim(),
    eventName: input.goalType === "RETURN" ? null : input.eventName?.trim() || null,
    raceDate: input.goalType === "RETURN" ? null : input.raceDate,
    availableDays: [...new Set(input.availableDays)].sort((a, b) => a - b),
    latitude: input.latitude ?? -6.2088,
    longitude: input.longitude ?? 106.8456,
    timezone,
    createdAt: nowIso(),
  };
  const planInput: PlanInput = { ...profile, startDate: today };
  const workouts: Workout[] = generatePlan(planInput).map((w) => ({ ...w, id: uid(), status: "PLANNED" }));
  commit({ ...empty(), profile, workouts });
  return profile;
}

export function updateProfile(patch: Partial<Pick<Profile, "autonomy" | "latitude" | "longitude" | "name" | "eventName">>) {
  const s = load();
  commit({ ...s, profile: { ...requireProfile(s), ...patch } });
}

export function resetAll() {
  storage().removeItem(KEY);
  commit(empty());
}

export function exportData(): string {
  return JSON.stringify({ exportedAt: nowIso(), app: "pace", ...load() }, null, 2);
}

// ---------- readiness ----------

export function saveSignal(input: { sleepHours?: number | null; hrvDeltaPct?: number | null; feeling?: Feeling | null }, now?: Date) {
  const s = load();
  const p = requireProfile(s);
  const date = todayOf(p, now);
  const sig: Signal = { date, sleepHours: input.sleepHours ?? null, hrvDeltaPct: input.hrvDeltaPct ?? null, feeling: input.feeling ?? null };
  commit({ ...s, signals: [...s.signals.filter((x) => x.date !== date), sig] });
  return recomputeDaily(now);
}

export function readinessFor(s: State, date: string): Readiness {
  const sig = signalOf(s, date);
  const yesterday = s.activities
    .filter((a) => a.date === addDays(date, -1))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const recent = s.activities.filter((a) => a.date >= addDays(date, -28) && a.date <= date);
  const acute = recent.filter((a) => diffDays(date, a.date) < 7).reduce((t, a) => t + a.distanceKm, 0);
  const chronic = recent.reduce((t, a) => t + a.distanceKm, 0) / 4;
  return computeReadiness({
    sleepHours: sig?.sleepHours,
    hrvDeltaPct: sig?.hrvDeltaPct,
    feeling: sig?.feeling,
    yesterdayRpe: yesterday?.rpe,
    loadRatio: chronic > 5 ? acute / chronic : null,
  });
}

export function consecutivePainReports(s: State): number {
  const last = [...s.activities]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  let n = 0;
  for (const a of last) {
    if (!a.pain) break;
    n++;
  }
  return n;
}

// ---------- daily agent ----------

function dailyFor(s: State, date: string) {
  return s.adjustments.filter((a) => a.date === date && a.trigger === "DAILY").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Sense → Decide → Act, sekali per hari (idempotent).
 * AUTO: langsung diterapkan. ASK/SUGGEST: disimpan sebagai usulan.
 * Cuaca/AQI hanya memengaruhi saran jam lari (dihitung di UI), bukan struktur rencana.
 */
export function runDailyAgent(now?: Date): Adjustment | null {
  const s = load();
  const p = requireProfile(s);
  const date = todayOf(p, now);
  const [existing] = dailyFor(s, date);
  if (existing) return existing;
  const before = weekOf(s, date);
  const decision = decideToday({
    ...ctxOf(p, date),
    week: before,
    readiness: readinessFor(s, date),
    conditions: null,
    consecutivePainReports: consecutivePainReports(s),
  });
  if (!decision.changed) return null;
  const status = p.autonomy === "AUTO" ? "APPLIED" : "PROPOSED";
  const adj: Adjustment = {
    id: uid(),
    date,
    trigger: "DAILY",
    reason: decision.reason,
    before,
    after: decision.week,
    status,
    createdAt: nowIso(),
  };
  const base = status === "APPLIED" ? withWeek(s, decision.week) : s;
  commit({ ...base, adjustments: [...base.adjustments, adj] });
  return adj;
}

/** Sinyal baru masuk: batalkan keputusan harian hari ini lalu hitung ulang. */
export function recomputeDaily(now?: Date): Adjustment | null {
  let s = load();
  const p = requireProfile(s);
  const date = todayOf(p, now);
  for (const a of dailyFor(s, date)) {
    if (a.status === "APPLIED") s = withWeek(s, a.before);
    s = { ...s, adjustments: s.adjustments.filter((x) => x.id !== a.id) };
  }
  commit(s);
  return runDailyAgent(now);
}

export function resolveAdjustment(id: string, action: "accept" | "dismiss" | "undo") {
  const s = load();
  const a = s.adjustments.find((x) => x.id === id);
  if (!a) throw new PaceError("Perubahan tidak ditemukan.");
  const setStatus = (base: State, status: Adjustment["status"]): State => ({
    ...base,
    adjustments: base.adjustments.map((x) => (x.id === id ? { ...x, status } : x)),
  });
  if (action === "accept") {
    if (a.status !== "PROPOSED") throw new PaceError("Usulan ini sudah diproses.");
    commit(setStatus(withWeek(s, a.after), "APPLIED"));
  } else if (action === "dismiss") {
    if (a.status !== "PROPOSED") throw new PaceError("Usulan ini sudah diproses.");
    commit(setStatus(s, "DISMISSED"));
  } else {
    if (a.status !== "APPLIED") throw new PaceError("Hanya perubahan yang sudah diterapkan yang bisa dibatalkan.");
    commit(setStatus(withWeek(s, a.before), "REVERTED"));
  }
}

// ---------- skip & swap ----------

function workoutById(s: State, id: string): Workout {
  const w = s.workouts.find((x) => x.id === id);
  if (!w) throw new PaceError("Sesi tidak ditemukan.");
  return w;
}

export function previewSkip(workoutId: string) {
  const s = load();
  const p = requireProfile(s);
  const w = workoutById(s, workoutId);
  const before = weekOf(s, w.date);
  return { date: w.date, before, ...skipWorkout(before, workoutId, ctxOf(p, w.date)) };
}

export function applySkip(workoutId: string) {
  const r = previewSkip(workoutId);
  const s = load();
  const adj: Adjustment = {
    id: uid(),
    date: r.date,
    trigger: "SKIP",
    reason: r.notes.join(" "),
    before: r.before,
    after: r.week,
    status: "APPLIED",
    createdAt: nowIso(),
  };
  const next = withWeek(s, r.week);
  commit({ ...next, adjustments: [...next.adjustments, adj] });
  return r;
}

export function listSwapOptions(workoutId: string): SwapOption[] {
  const s = load();
  const p = requireProfile(s);
  const w = workoutById(s, workoutId);
  return swapOptions(weekOf(s, w.date), workoutId, ctxOf(p, w.date));
}

export function applySwap(workoutId: string, key: SwapOption["key"]) {
  const s = load();
  const w = workoutById(s, workoutId);
  const before = weekOf(s, w.date);
  const opt = listSwapOptions(workoutId).find((o) => o.key === key);
  if (!opt) throw new PaceError("Pilihan swap tidak valid.");
  const adj: Adjustment = {
    id: uid(),
    date: w.date,
    trigger: "SWAP",
    reason: opt.detail,
    before,
    after: opt.week,
    status: "APPLIED",
    createdAt: nowIso(),
  };
  const next = withWeek(s, opt.week);
  commit({ ...next, adjustments: [...next.adjustments, adj] });
}

// ---------- check-in ----------

export interface CheckInInput {
  workoutId?: string | null;
  date?: string;
  distanceKm: number;
  durationSec: number;
  avgHr?: number | null;
  rpe: number;
  pain?: Pain | null;
}

export function checkIn(input: CheckInInput, now?: Date): { activity: Activity; feedback: string } {
  const s = load();
  const p = requireProfile(s);
  if (!(input.distanceKm > 0 && input.distanceKm <= 100)) throw new PaceError("Jarak tidak valid.");
  if (!(input.durationSec > 0)) throw new PaceError("Durasi tidak valid.");
  if (input.rpe < 1 || input.rpe > 10) throw new PaceError("RPE harus 1–10.");
  if (input.workoutId) workoutById(s, input.workoutId);
  const activity: Activity = {
    id: uid(),
    date: input.date ?? todayOf(p, now),
    distanceKm: input.distanceKm,
    durationSec: Math.round(input.durationSec),
    avgHr: input.avgHr ?? null,
    rpe: input.rpe,
    pain: input.pain ?? null,
    workoutId: input.workoutId ?? null,
    createdAt: nowIso(),
  };
  const next: State = {
    ...s,
    activities: [...s.activities, activity],
    workouts: input.workoutId ? s.workouts.map((w) => (w.id === input.workoutId ? { ...w, status: "DONE" } : w)) : s.workouts,
  };
  commit(next);
  return { activity, feedback: feedbackFor(next, activity) };
}

export function feedbackFor(s: State, a: Activity): string {
  const pace = a.durationSec / a.distanceKm;
  if (a.pain) {
    return consecutivePainReports(s) >= 2
      ? "Nyeri dilaporkan dua kali berturut-turut. Sesi berat ditahan dulu; kalau berlanjut, periksakan ke dokter atau fisioterapis."
      : "Nyeri dicatat. Besok Pace akan cek lagi sebelum memberi sesi berat.";
  }
  if (a.rpe != null && a.rpe >= 8) return `RPE ${a.rpe} cukup berat untuk sesi ini. Sesi berikutnya akan disesuaikan kalau tubuhmu belum pulih.`;
  if (a.avgHr) {
    const past = s.activities.filter(
      (x) =>
        x.date >= addDays(a.date, -35) &&
        x.date <= addDays(a.date, -14) &&
        x.avgHr &&
        Math.abs(x.avgHr - a.avgHr!) <= 5 &&
        x.distanceKm >= 3,
    );
    if (past.length) {
      const pastPace = past.reduce((t, x) => t + x.durationSec / x.distanceKm, 0) / past.length;
      const delta = Math.round(pastPace - pace);
      if (delta >= 3) return `Pace ${formatPace(pace)} di HR ${a.avgHr}, lebih cepat ${delta} detik dari beberapa minggu lalu di HR yang sama.`;
    }
  }
  return `Tercatat ${String(a.distanceKm).replace(".", ",")} km di ${formatPace(pace)}/km. Konsisten adalah kuncinya.`;
}

// ---------- brief ----------

/** Jalankan agent harian lalu susun brief. */
export function getBrief(now?: Date) {
  runDailyAgent(now);
  return briefFrom(load(), now);
}

/** Susun brief dari state (murni, aman dipanggil saat render). */
export function briefFrom(s: State, now?: Date) {
  const p = requireProfile(s);
  const date = todayOf(p, now);
  const [adjustment] = dailyFor(s, date);
  const week = weekOf(s, date);
  const today = week.find((w) => w.date === date) ?? null;
  const readiness = readinessFor(s, date);
  return {
    date,
    user: { name: p.name, autonomy: p.autonomy },
    location: { lat: p.latitude, lon: p.longitude, timezone: p.timezone },
    weekNumber: today?.week ?? week[0]?.week ?? 0,
    totalWeeks: totalWeeks(s),
    phase: today?.phase ?? null,
    readiness: { ...readiness, label: LEVEL_LABEL[readiness.level] },
    hasSignalToday: !!signalOf(s, date),
    signal: signalOf(s, date),
    today,
    doneActivity: today ? (s.activities.filter((a) => a.workoutId === today.id).at(-1) ?? null) : null,
    original: adjustment?.status === "APPLIED" ? (adjustment.before.find((w) => w.date === date) ?? null) : null,
    adjustment: adjustment
      ? {
          id: adjustment.id,
          status: adjustment.status,
          reason: adjustment.reason,
          proposed: adjustment.status === "PROPOSED" ? (adjustment.after.find((w) => w.date === date) ?? null) : null,
        }
      : null,
    paces: pacesOf(p),
    week,
    plannedKm: weekKm(week),
    titles: { today: today ? workoutTitle(today) : null },
  };
}

export type Brief = ReturnType<typeof briefFrom>;

// ---------- dashboard progres menuju event ----------

export const RACE_KM: Record<GoalType, number | null> = { "10K": 10, HM: 21.0975, FM: 42.195, RETURN: null };
export const GOAL_LABEL: Record<GoalType, string> = { "10K": "10K", HM: "Half marathon", FM: "Marathon", RETURN: "Kembali rutin lari" };
const PHASE_LABEL: Record<Workout["phase"], string> = { COMEBACK: "Comeback", BASE: "Base", BUILD: "Build", PEAK: "Peak", TAPER: "Taper" };

/** Prediksi waktu finish (rumus Riegel, eksponen 1,06) dari satu lari. */
export function riegel(distanceKm: number, durationSec: number, targetKm: number): number {
  return durationSec * Math.pow(targetKm / distanceKm, 1.06);
}

export type DashboardStatus = "EARLY" | "ON_TRACK" | "INCONSISTENT" | "BEHIND";

export function dashboardFrom(s: State, now?: Date) {
  const p = requireProfile(s);
  const today = todayOf(p, now);
  const raceKm = RACE_KM[p.goalType];
  const runs = (w: Workout) => w.type !== "REST" && w.type !== "MOBILITY";

  // Minggu-minggu rencana
  const byWeek = new Map<number, Workout[]>();
  for (const w of [...s.workouts].sort((a, b) => a.date.localeCompare(b.date))) byWeek.set(w.week, [...(byWeek.get(w.week) ?? []), w]);
  const doneKmByWorkout = new Map<string, number>();
  for (const a of s.activities) if (a.workoutId) doneKmByWorkout.set(a.workoutId, (doneKmByWorkout.get(a.workoutId) ?? 0) + a.distanceKm);
  const weeks = [...byWeek.entries()].map(([week, ws]) => {
    const start = weekStart(ws[0].date);
    const end = addDays(start, 6);
    const plannedKm = ws.filter((w) => runs(w) && w.status !== "DROPPED").reduce((t, w) => t + w.distanceKm, 0);
    // Semua lari tercatat di minggu itu (termasuk di luar rencana)
    const doneKm = s.activities.filter((a) => a.date >= start && a.date <= end).reduce((t, a) => t + a.distanceKm, 0);
    return {
      week,
      startDate: start,
      phase: ws[0].phase,
      plannedKm: Math.round(plannedKm * 10) / 10,
      doneKm: Math.round(doneKm * 10) / 10,
      isCurrent: today >= start && today <= end,
      isFuture: start > today,
    };
  });
  const current = weeks.find((w) => w.isCurrent) ?? (weeks.length && today > weeks[weeks.length - 1].startDate ? weeks[weeks.length - 1] : weeks[0]);

  // Fase sebagai rentang minggu
  const phases: { phase: Workout["phase"]; label: string; startWeek: number; endWeek: number }[] = [];
  for (const w of weeks) {
    const last = phases[phases.length - 1];
    if (last && last.phase === w.phase) last.endWeek = w.week;
    else phases.push({ phase: w.phase, label: PHASE_LABEL[w.phase], startWeek: w.week, endWeek: w.week });
  }

  // Kepatuhan 4 minggu terakhir: sesi lari terjadwal sampai hari ini
  const windowStart = addDays(today, -27);
  const due = s.workouts.filter((w) => runs(w) && w.date >= windowStart && w.date <= today && w.status !== "DROPPED");
  const doneDue = due.filter((w) => w.status === "DONE").length;
  // Sesi hari ini yang belum dijalani tidak dihitung "terlewat"
  const missedToday = due.filter((w) => w.date === today && w.status === "PLANNED").length;
  const denom = due.length - missedToday;
  const adherence = { done: doneDue, planned: denom, pct: denom > 0 ? Math.round((doneDue / denom) * 100) : null };
  const status: DashboardStatus =
    adherence.pct === null || denom < 3 ? "EARLY" : adherence.pct >= 75 ? "ON_TRACK" : adherence.pct >= 50 ? "INCONSISTENT" : "BEHIND";

  // Prediksi finish dari lari terbaik 6 minggu terakhir (>= 3 km)
  const recentRuns = s.activities.filter((a) => a.date >= addDays(today, -42) && a.date <= today && a.distanceKm >= 3);
  let prediction: { timeSec: number; basedOn: Activity } | null = null;
  if (raceKm) {
    for (const a of recentRuns) {
      const t = riegel(a.distanceKm, a.durationSec, raceKm);
      if (!prediction || t < prediction.timeSec) prediction = { timeSec: t, basedOn: a };
    }
  }
  const targetTimeSec = raceKm && p.targetPaceSec ? p.targetPaceSec * raceKm : null;

  // Long run
  const longestRecentKm = recentRuns.reduce((m, a) => Math.max(m, a.distanceKm), 0);
  const peakLongKm = s.workouts.filter((w) => w.type === "LONG").reduce((m, w) => Math.max(m, w.distanceKm), 0);

  // Tren readiness 14 hari (hanya hari dengan check-in)
  const readinessTrend = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    return { date, score: signalOf(s, date) ? readinessFor(s, date).score : null };
  });

  // Konsistensi: minggu berturut-turut (sampai minggu lalu / minggu ini) yang ada larinya
  let streakWeeks = 0;
  for (let mon = weekStart(today); ; mon = addDays(mon, -7)) {
    const has = s.activities.some((a) => a.date >= mon && a.date <= addDays(mon, 6));
    if (has) streakWeeks++;
    else if (mon !== weekStart(today)) break;
    if (streakWeeks > 104 || mon < addDays(today, -800)) break;
  }

  const totalKm = Math.round(s.activities.reduce((t, a) => t + a.distanceKm, 0) * 10) / 10;

  return {
    today,
    goal: {
      type: p.goalType,
      label: GOAL_LABEL[p.goalType],
      eventName: p.eventName ?? null,
      raceDate: p.raceDate,
      raceKm,
      daysLeft: p.raceDate ? diffDays(p.raceDate, today) : null,
      targetPaceSec: p.targetPaceSec,
      targetTimeSec,
    },
    plan: {
      week: current?.week ?? 0,
      totalWeeks: weeks.length,
      phase: current?.phase ?? null,
      phaseLabel: current ? PHASE_LABEL[current.phase] : null,
      phases,
    },
    weeks,
    adherence,
    status,
    prediction,
    longRun: { longestRecentKm, peakLongKm },
    readinessTrend,
    streakWeeks,
    totals: { runs: s.activities.length, km: totalKm },
    recent: [...s.activities].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  };
}

export type Dashboard = ReturnType<typeof dashboardFrom>;

/** Format durasi detik → "1:58:30" atau "52:10". */
export function formatDuration(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}
