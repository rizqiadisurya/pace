import "server-only";
import { and, desc, eq, gte, lte, max } from "drizzle-orm";
import { activities, adjustments, dailySignals, getDb, users, workouts, type User, type WorkoutRow } from "@/db";
import {
  LEVEL_LABEL,
  addDays,
  assessConditions,
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
  type Decision,
  type PlanInput,
  type Readiness,
  type Workout,
} from "./engine";
import { getHourlyConditions } from "./weather";
import { HttpError } from "./errors";

// ---------- mapping ----------

const toWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  date: r.date,
  week: r.week,
  phase: r.phase,
  type: r.type,
  distanceKm: r.distanceKm,
  description: r.description,
  status: r.status,
  originalDate: r.originalDate,
  originalType: (r.originalType as Workout["type"] | null) ?? null,
});

export const availableDaysOf = (u: User) => u.availableDays.split(",").filter(Boolean).map(Number);
export const pacesOf = (u: User) => pacesFor({ easyPaceSec: u.easyPaceSec, targetPaceSec: u.targetPaceSec });
export const todayOf = (u: User) => todayInTz(u.timezone);

export function planInputOf(u: User, startDate: string): PlanInput {
  return {
    startDate,
    goalType: u.goalType,
    raceDate: u.raceDate,
    easyPaceSec: u.easyPaceSec,
    targetPaceSec: u.targetPaceSec,
    baseWeeklyKm: u.baseWeeklyKm,
    weeksOff: u.weeksOff,
    availableDays: availableDaysOf(u),
    longRunDay: u.longRunDay,
  };
}

// ---------- users ----------

export type NewUser = typeof users.$inferInsert;

export async function createUser(values: NewUser): Promise<User> {
  const db = await getDb();
  const [u] = await db.insert(users).values(values).returning();
  return u;
}

export async function updateUser(userId: string, patch: Partial<NewUser>) {
  const db = await getDb();
  await db.update(users).set(patch).where(eq(users.id, userId));
}

export async function deleteUser(userId: string) {
  const db = await getDb();
  await db.delete(users).where(eq(users.id, userId));
}

// ---------- plan ----------

export async function createPlan(u: User, startDate: string) {
  const db = await getDb();
  const plan = generatePlan(planInputOf(u, startDate));
  await db.transaction(async (tx) => {
    await tx.delete(workouts).where(eq(workouts.userId, u.id));
    await tx.insert(workouts).values(plan.map((w) => ({ ...w, userId: u.id })));
  });
  return plan.length;
}

export async function getWeekOf(userId: string, date: string): Promise<Workout[]> {
  const db = await getDb();
  const mon = weekStart(date);
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, mon), lte(workouts.date, addDays(mon, 6))))
    .orderBy(workouts.date);
  return rows.map(toWorkout);
}

export async function totalWeeksOf(userId: string): Promise<number> {
  const db = await getDb();
  const [r] = await db.select({ n: max(workouts.week) }).from(workouts).where(eq(workouts.userId, userId));
  return r?.n ?? 0;
}

export async function getPlan(userId: string): Promise<Workout[]> {
  const db = await getDb();
  const rows = await db.select().from(workouts).where(eq(workouts.userId, userId)).orderBy(workouts.date);
  return rows.map(toWorkout);
}

/** Simpan perubahan minggu (satu transaksi). */
export async function saveWeek(userId: string, week: Workout[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const w of week) {
      await tx
        .update(workouts)
        .set({
          type: w.type,
          distanceKm: w.distanceKm,
          description: w.description,
          status: w.status,
          originalDate: w.originalDate ?? null,
          originalType: w.originalType ?? null,
        })
        .where(and(eq(workouts.id, w.id), eq(workouts.userId, userId)));
    }
  });
}

// ---------- readiness ----------

export async function upsertSignal(
  userId: string,
  date: string,
  s: { sleepHours?: number | null; hrvDeltaPct?: number | null; feeling?: "FRESH" | "OK" | "TIRED" | null },
) {
  const db = await getDb();
  const values = { sleepHours: s.sleepHours ?? null, hrvDeltaPct: s.hrvDeltaPct ?? null, feeling: s.feeling ?? null };
  await db
    .insert(dailySignals)
    .values({ userId, date, ...values })
    .onConflictDoUpdate({ target: [dailySignals.userId, dailySignals.date], set: values });
}

async function signalFor(userId: string, date: string) {
  const db = await getDb();
  const [s] = await db
    .select()
    .from(dailySignals)
    .where(and(eq(dailySignals.userId, userId), eq(dailySignals.date, date)))
    .limit(1);
  return s ?? null;
}

export async function readinessFor(u: User, date: string): Promise<Readiness> {
  const db = await getDb();
  const sig = await signalFor(u.id, date);
  const [yesterday] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, u.id), eq(activities.date, addDays(date, -1))))
    .orderBy(desc(activities.createdAt))
    .limit(1);
  const recent = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, u.id), gte(activities.date, addDays(date, -28)), lte(activities.date, date)));
  const acute = recent.filter((a) => diffDays(date, a.date) < 7).reduce((s, a) => s + a.distanceKm, 0);
  const chronic = recent.reduce((s, a) => s + a.distanceKm, 0) / 4;
  return computeReadiness({
    sleepHours: sig?.sleepHours,
    hrvDeltaPct: sig?.hrvDeltaPct,
    feeling: sig?.feeling,
    yesterdayRpe: yesterday?.rpe,
    loadRatio: chronic > 5 ? acute / chronic : null,
  });
}

export async function consecutivePainReports(userId: string): Promise<number> {
  const db = await getDb();
  const last = await db
    .select({ pain: activities.pain })
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.date), desc(activities.createdAt))
    .limit(3);
  let n = 0;
  for (const a of last) {
    if (!a.pain) break;
    n++;
  }
  return n;
}

// ---------- daily agent ----------

async function decisionFor(u: User, date: string): Promise<Decision> {
  const [hours, week, readiness, pain] = await Promise.all([
    getHourlyConditions(u.latitude, u.longitude, date, u.timezone),
    getWeekOf(u.id, date),
    readinessFor(u, date),
    consecutivePainReports(u.id),
  ]);
  return decideToday({
    today: date,
    week,
    readiness,
    conditions: hours ? assessConditions(hours, 6) : null,
    consecutivePainReports: pain,
    availableDays: availableDaysOf(u),
    paces: pacesOf(u),
  });
}

async function recordAdjustment(
  u: User,
  date: string,
  trigger: "DAILY" | "SKIP" | "SWAP" | "CHECKIN",
  reason: string,
  before: Workout[],
  after: Workout[],
  status: "APPLIED" | "PROPOSED",
) {
  const db = await getDb();
  const [a] = await db
    .insert(adjustments)
    .values({ userId: u.id, date, trigger, reason, before: JSON.stringify(before), after: JSON.stringify(after), status })
    .returning();
  return a;
}

async function dailyAdjustments(userId: string, date: string) {
  const db = await getDb();
  return db
    .select()
    .from(adjustments)
    .where(and(eq(adjustments.userId, userId), eq(adjustments.date, date), eq(adjustments.trigger, "DAILY")))
    .orderBy(desc(adjustments.createdAt));
}

/**
 * Jalankan siklus Sense → Decide → Act sekali per hari (idempotent).
 * Autonomy AUTO: langsung diterapkan. ASK/SUGGEST: disimpan sebagai usulan.
 */
export async function runDailyAgent(u: User, date = todayOf(u)) {
  const [existing] = await dailyAdjustments(u.id, date);
  const decision = await decisionFor(u, date);
  if (existing) return { decision, adjustment: existing };
  if (!decision.changed) return { decision, adjustment: null };

  const before = await getWeekOf(u.id, date);
  const status = u.autonomy === "AUTO" ? "APPLIED" : "PROPOSED";
  if (status === "APPLIED") await saveWeek(u.id, decision.week);
  const adjustment = await recordAdjustment(u, date, "DAILY", decision.reason, before, decision.week, status);
  return { decision, adjustment };
}

/** Sinyal baru (mis. jam tidur) masuk: batalkan keputusan harian hari ini lalu hitung ulang. */
export async function recomputeDaily(u: User, date = todayOf(u)) {
  const db = await getDb();
  for (const a of await dailyAdjustments(u.id, date)) {
    if (a.status === "APPLIED") await saveWeek(u.id, JSON.parse(a.before));
    await db.delete(adjustments).where(eq(adjustments.id, a.id));
  }
  return runDailyAgent(u, date);
}

export async function resolveAdjustment(u: User, id: string, action: "accept" | "dismiss" | "undo") {
  const db = await getDb();
  const [a] = await db
    .select()
    .from(adjustments)
    .where(and(eq(adjustments.id, id), eq(adjustments.userId, u.id)))
    .limit(1);
  if (!a) throw new HttpError(404, "Perubahan tidak ditemukan.");
  const setStatus = (status: "APPLIED" | "DISMISSED" | "REVERTED") =>
    db.update(adjustments).set({ status }).where(eq(adjustments.id, id));
  if (action === "accept") {
    if (a.status !== "PROPOSED") throw new HttpError(409, "Usulan ini sudah diproses.");
    await saveWeek(u.id, JSON.parse(a.after));
    await setStatus("APPLIED");
  } else if (action === "dismiss") {
    if (a.status !== "PROPOSED") throw new HttpError(409, "Usulan ini sudah diproses.");
    await setStatus("DISMISSED");
  } else {
    if (a.status !== "APPLIED") throw new HttpError(409, "Hanya perubahan yang sudah diterapkan yang bisa dibatalkan.");
    await saveWeek(u.id, JSON.parse(a.before));
    await setStatus("REVERTED");
  }
}

// ---------- skip & swap ----------

async function rowFor(u: User, workoutId: string) {
  const db = await getDb();
  const [w] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, u.id)))
    .limit(1);
  if (!w) throw new HttpError(404, "Sesi tidak ditemukan.");
  return w;
}

const ctxOf = (u: User, today: string) => ({ today, availableDays: availableDaysOf(u), paces: pacesOf(u) });

export async function previewSkip(u: User, workoutId: string) {
  const w = await rowFor(u, workoutId);
  const before = await getWeekOf(u.id, w.date);
  const result = skipWorkout(before, workoutId, ctxOf(u, w.date));
  return { date: w.date, before, ...result };
}

export async function applySkip(u: User, workoutId: string) {
  const p = await previewSkip(u, workoutId);
  await saveWeek(u.id, p.week);
  const adj = await recordAdjustment(u, p.date, "SKIP", p.notes.join(" "), p.before, p.week, "APPLIED");
  return { ...p, adjustmentId: adj.id };
}

export async function listSwapOptions(u: User, workoutId: string) {
  const w = await rowFor(u, workoutId);
  return swapOptions(await getWeekOf(u.id, w.date), workoutId, ctxOf(u, w.date));
}

export async function applySwap(u: User, workoutId: string, key: string) {
  const w = await rowFor(u, workoutId);
  const before = await getWeekOf(u.id, w.date);
  const opt = swapOptions(before, workoutId, ctxOf(u, w.date)).find((o) => o.key === key);
  if (!opt) throw new HttpError(400, "Pilihan swap tidak valid.");
  await saveWeek(u.id, opt.week);
  const adj = await recordAdjustment(u, w.date, "SWAP", opt.detail, before, opt.week, "APPLIED");
  return { adjustmentId: adj.id, option: opt };
}

// ---------- check-in ----------

export interface CheckInInput {
  workoutId?: string | null;
  date?: string;
  distanceKm: number;
  durationSec: number;
  avgHr?: number | null;
  rpe: number;
  pain?: "KNEE" | "SHIN_CALF" | "OTHER" | null;
}

export async function checkIn(u: User, input: CheckInInput) {
  const db = await getDb();
  const date = input.date ?? todayOf(u);
  if (input.workoutId) await rowFor(u, input.workoutId);
  const [act] = await db
    .insert(activities)
    .values({
      userId: u.id,
      date,
      source: "MANUAL",
      distanceKm: input.distanceKm,
      durationSec: input.durationSec,
      avgHr: input.avgHr ?? null,
      rpe: input.rpe,
      pain: input.pain ?? null,
      workoutId: input.workoutId ?? null,
    })
    .returning();
  if (input.workoutId) await db.update(workouts).set({ status: "DONE" }).where(eq(workouts.id, input.workoutId));
  return { activity: act, feedback: await feedbackFor(u, act.id) };
}

/** Umpan balik satu kalimat: progres pace di HR serupa, atau peringatan nyeri. */
export async function feedbackFor(u: User, activityId: string): Promise<string> {
  const db = await getDb();
  const [a] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
  if (!a) return "";
  const pace = a.durationSec / a.distanceKm;
  if (a.pain) {
    const n = await consecutivePainReports(u.id);
    return n >= 2
      ? "Nyeri dilaporkan dua kali berturut-turut. Sesi berat ditahan dulu; kalau berlanjut, periksakan ke dokter atau fisioterapis."
      : "Nyeri dicatat. Besok Pace akan cek lagi sebelum memberi sesi berat.";
  }
  if (a.rpe != null && a.rpe >= 8)
    return `RPE ${a.rpe} cukup berat untuk sesi ini. Sesi berikutnya akan disesuaikan kalau tubuhmu belum pulih.`;
  if (a.avgHr) {
    const past = (
      await db
        .select()
        .from(activities)
        .where(
          and(eq(activities.userId, u.id), gte(activities.date, addDays(a.date, -35)), lte(activities.date, addDays(a.date, -14))),
        )
    ).filter((p) => p.avgHr && Math.abs(p.avgHr - a.avgHr!) <= 5 && p.distanceKm >= 3);
    if (past.length) {
      const pastPace = past.reduce((s, p) => s + p.durationSec / p.distanceKm, 0) / past.length;
      const delta = Math.round(pastPace - pace);
      if (delta >= 3)
        return `Pace ${formatPace(pace)} di HR ${a.avgHr}, lebih cepat ${delta} detik dari beberapa minggu lalu di HR yang sama.`;
    }
  }
  return `Tercatat ${a.distanceKm.toString().replace(".", ",")} km di ${formatPace(pace)}/km. Konsisten adalah kuncinya.`;
}

// ---------- brief ----------

export async function getBrief(u: User) {
  const date = todayOf(u);
  const { decision, adjustment } = await runDailyAgent(u, date);
  const [week, readiness, totalWeeks, signal] = await Promise.all([
    getWeekOf(u.id, date),
    readinessFor(u, date),
    totalWeeksOf(u.id),
    signalFor(u.id, date),
  ]);
  const today = week.find((w) => w.date === date) ?? null;
  const proposed =
    adjustment?.status === "PROPOSED" ? ((JSON.parse(adjustment.after) as Workout[]).find((w) => w.date === date) ?? null) : null;
  // Sesi sebelum diubah agent (untuk dicoret di UI), hanya jika perubahan sudah diterapkan.
  const original =
    adjustment?.status === "APPLIED" ? ((JSON.parse(adjustment.before) as Workout[]).find((w) => w.date === date) ?? null) : null;
  return {
    date,
    user: { name: u.name, autonomy: u.autonomy, stravaConnected: !!u.stravaAthleteId },
    weekNumber: today?.week ?? week[0]?.week ?? 0,
    totalWeeks,
    phase: today?.phase ?? null,
    readiness: { ...readiness, label: LEVEL_LABEL[readiness.level] },
    hasSignalToday: !!signal,
    today,
    original,
    adjustment: adjustment ? { id: adjustment.id, status: adjustment.status, reason: adjustment.reason, proposed } : null,
    timeAdvice: decision.timeAdvice,
    paces: pacesOf(u),
    week,
    plannedKm: weekKm(week),
    titles: { today: today ? workoutTitle(today) : null },
  };
}

export type Brief = Awaited<ReturnType<typeof getBrief>>;
