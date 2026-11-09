import { dayOfWeek, formatDateId, type ISODate } from "./dates";
import { spacingViolations } from "./guardrails";
import { describe } from "./plan";
import { isHard, workoutTitle, type PaceProfile, type Workout, type WorkoutType } from "./types";

export interface RescheduleContext {
  today: ISODate;
  availableDays: number[];
  paces: PaceProfile;
}

export interface RescheduleResult {
  week: Workout[];
  notes: string[];
}

const clone = (week: Workout[]) => week.map((w) => ({ ...w }));

interface Payload {
  type: WorkoutType;
  distanceKm: number;
  description: string;
  fromDate: ISODate;
}

/**
 * Tempatkan sesi (kualitas/long/easy) ke hari setelah `after` di minggu yang sama.
 * Prioritas: tukar dengan easy run yang ada, lalu hari REST yang termasuk hari tersedia.
 * Setiap percobaan divalidasi guardrail jarak 48 jam. Gagal → null (sesi didrop, tidak menumpuk).
 */
export function placeLater(
  week: Workout[],
  payload: Payload,
  after: ISODate,
  ctx: RescheduleContext,
): { week: Workout[]; placed: Workout | null } {
  const later = week.filter((w) => w.date > after && w.status === "PLANNED").sort((a, b) => a.date.localeCompare(b.date));
  const easySlots = isHard(payload.type) ? later.filter((w) => w.type === "EASY" || w.type === "STRIDES") : [];
  const restSlots = later.filter((w) => w.type === "REST" && ctx.availableDays.includes(dayOfWeek(w.date)));

  for (const slot of [...easySlots, ...restSlots]) {
    const trial = clone(week);
    const t = trial.find((w) => w.id === slot.id)!;
    t.originalType = t.originalType ?? t.type;
    t.originalDate = payload.fromDate;
    t.type = payload.type;
    t.distanceKm = payload.distanceKm;
    t.description = payload.description;
    if (spacingViolations(trial).length === 0) return { week: trial, placed: t };
  }
  return { week, placed: null };
}

/** Pengguna menekan Skip untuk sesi tertentu. */
export function skipWorkout(week: Workout[], workoutId: string, ctx: RescheduleContext): RescheduleResult {
  const next = clone(week);
  const w = next.find((x) => x.id === workoutId);
  if (!w || w.status !== "PLANNED" || w.type === "REST") return { week, notes: [] };
  const notes: string[] = [];
  const payload: Payload = { type: w.type, distanceKm: w.distanceKm, description: w.description, fromDate: w.date };
  w.status = "SKIPPED";
  notes.push(`${workoutTitle(payload)} hari ini dilewati.`);

  if (w.type === "MOBILITY") return { week: next, notes };
  const { week: placedWeek, placed } = placeLater(next, payload, w.date, ctx);
  if (placed) {
    const swapped = placed.originalType && placed.originalType !== "REST";
    notes.push(
      `${workoutTitle(payload)} dipindah ke ${formatDateId(placed.date)}${swapped ? `, menggantikan ${workoutTitle({ type: placed.originalType!, distanceKm: payload.distanceKm }).replace(/ [\d,]+ km$/, "")}` : ""}.`,
    );
    return { week: placedWeek, notes };
  }
  notes.push(`Tidak ada slot aman minggu ini, jadi sesi ini dilepas supaya latihan tidak menumpuk.`);
  return { week: next, notes };
}

export interface SwapOption {
  key: "EASY" | "SHORTER" | "TREADMILL" | "MOBILITY" | "SWAP_LATER";
  label: string;
  detail: string;
  week: Workout[];
}

/** Alternatif untuk sesi hari ini (tombol Swap). */
export function swapOptions(week: Workout[], workoutId: string, ctx: RescheduleContext): SwapOption[] {
  const w = week.find((x) => x.id === workoutId);
  if (!w || w.status !== "PLANNED" || w.type === "REST") return [];
  const opts: SwapOption[] = [];
  const replace = (patch: Partial<Workout>) => {
    const next = clone(week);
    const t = next.find((x) => x.id === workoutId)!;
    t.originalType = t.originalType ?? t.type;
    Object.assign(t, patch);
    return next;
  };

  if (isHard(w.type)) {
    const km = Math.max(3, Math.round(w.distanceKm * 0.8 * 2) / 2);
    opts.push({
      key: "EASY",
      label: `Easy run ${km} km`,
      detail: "Ganti jadi lari santai, sesi berat dilepas minggu ini.",
      week: replace({ type: "EASY", distanceKm: km, description: describe("EASY", km, ctx.paces) }),
    });
    const later = placeLater(
      replace({ type: "EASY", distanceKm: km, description: describe("EASY", km, ctx.paces) }),
      { type: w.type, distanceKm: w.distanceKm, description: w.description, fromDate: w.date },
      w.date,
      ctx,
    );
    if (later.placed) {
      opts.push({
        key: "SWAP_LATER",
        label: `Tukar dengan ${formatDateId(later.placed.date)}`,
        detail: `Hari ini easy, ${workoutTitle(w).toLowerCase()} pindah ke ${formatDateId(later.placed.date)}.`,
        week: later.week,
      });
    }
  } else {
    const km = Math.max(3, Math.round(w.distanceKm * 0.6 * 2) / 2);
    opts.push({
      key: "SHORTER",
      label: `Easy run ${km} km`,
      detail: "Versi lebih pendek untuk hari yang sibuk.",
      week: replace({ type: "EASY", distanceKm: km, description: describe("EASY", km, ctx.paces) }),
    });
  }
  opts.push({
    key: "TREADMILL",
    label: "Pindah ke treadmill",
    detail: "Sesi sama, di dalam ruangan. Pakai incline 1%.",
    week: replace({ description: `Di treadmill, incline 1%. ${w.description}` }),
  });
  opts.push({
    key: "MOBILITY",
    label: "Mobility 20 menit",
    detail: "Tanpa lari hari ini, tetap bergerak.",
    week: replace({ type: "MOBILITY", distanceKm: 0, description: describe("MOBILITY", 0, ctx.paces) }),
  });
  return opts;
}
