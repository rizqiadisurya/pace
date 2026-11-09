import type { ConditionAssessment } from "./conditions";
import type { Readiness } from "./readiness";
import { describe, round05 } from "./plan";
import { placeLater, type RescheduleContext } from "./reschedule";
import { isHard, isQuality, isRun, workoutTitle, type Workout } from "./types";
import { formatDateId } from "./dates";

export type DecisionKind = "KEEP" | "DOWNGRADE" | "SHORTEN" | "RECOVER" | "PAIN_STOP";

export interface Decision {
  kind: DecisionKind;
  changed: boolean;
  week: Workout[];
  /** Satu kalimat alasan untuk morning brief */
  reason: string;
  notes: string[];
  /** Saran jam/lokasi lari karena cuaca/AQI (tidak mengubah rencana) */
  timeAdvice: string | null;
}

export interface DecideInput extends RescheduleContext {
  week: Workout[];
  readiness: Readiness;
  conditions: ConditionAssessment | null;
  /** Jumlah laporan nyeri berturut-turut dari check-in terakhir */
  consecutivePainReports: number;
}

const clone = (week: Workout[]) => week.map((w) => ({ ...w }));

function joinId(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} dan ${parts[parts.length - 1]}`;
}

function signalSentence(r: Readiness): string {
  const neg = r.factors
    .filter((f) => f.impact < 0)
    // "Tidur 4j" → "tidur 4j", tapi akronim seperti "HRV" tetap kapital
    .map((f) => (/^[A-Z][a-z]/.test(f.label) ? f.label.charAt(0).toLowerCase() + f.label.slice(1) : f.label));
  return neg.length ? `${joinId(neg).replace(/^./, (s) => s.toUpperCase())}.` : "";
}

export function timeAdvice(c: ConditionAssessment | null): string | null {
  if (!c || !c.flagged) return null;
  if (c.suggestIndoor) return `${joinId(c.reasons)}. Hari ini lebih aman lari di treadmill.`;
  if (c.bestHour != null)
    return `${joinId(c.reasons)}. Jam ${String(c.bestHour).padStart(2, "0")}.00 lebih baik${c.bestAqi != null ? ` (AQI ${c.bestAqi})` : ""}.`;
  return null;
}

/** Keputusan harian agent untuk sesi hari ini. Pure function: tidak menyentuh DB. */
export function decideToday(input: DecideInput): Decision {
  const { today, readiness, conditions } = input;
  const advice = timeAdvice(conditions);
  const base: Decision = { kind: "KEEP", changed: false, week: input.week, reason: "", notes: [], timeAdvice: advice };
  const todayW = input.week.find((w) => w.date === today && w.status === "PLANNED");
  if (!todayW || !isRun(todayW.type)) return base;

  const signals = signalSentence(readiness);
  const next = clone(input.week);
  const t = next.find((w) => w.id === todayW.id)!;
  const original = { ...t };

  // 1. Nyeri berulang: hentikan sesi kualitas minggu ini.
  if (input.consecutivePainReports >= 2 && (isHard(t.type) || next.some((w) => w.date > today && isQuality(w.type)))) {
    for (const w of next) {
      if (w.date >= today && w.status === "PLANNED" && isQuality(w.type)) {
        w.originalType = w.originalType ?? w.type;
        w.type = "EASY";
        w.distanceKm = Math.min(w.distanceKm, 5);
        w.description = describe("EASY", w.distanceKm, input.paces);
      }
    }
    t.originalType = t.originalType ?? original.type;
    t.type = "MOBILITY";
    t.distanceKm = 0;
    t.description = describe("MOBILITY", 0, input.paces);
    return {
      ...base,
      kind: "PAIN_STOP",
      changed: true,
      week: next,
      reason:
        "Kamu melaporkan nyeri dua kali berturut-turut. Sesi berat minggu ini diganti easy. Kalau nyeri berlanjut, konsultasikan ke dokter atau fisioterapis.",
      notes: ["Semua sesi kualitas minggu ini diganti easy run maks. 5 km."],
    };
  }

  // 2. Readiness rendah: pemulihan, sesi berat dicoba dipindah.
  if (readiness.level === "LOW") {
    t.originalType = t.originalType ?? original.type;
    t.type = "MOBILITY";
    t.distanceKm = 0;
    t.description = describe("MOBILITY", 0, input.paces);
    const notes: string[] = [];
    let week = next;
    if (isHard(original.type)) {
      const placed = placeLater(next, { ...original, fromDate: today }, today, input);
      week = placed.week;
      notes.push(
        placed.placed
          ? `${workoutTitle(original)} dipindah ke ${formatDateId(placed.placed.date)}.`
          : `${workoutTitle(original)} dilepas minggu ini supaya latihan tidak menumpuk.`,
      );
    }
    return {
      ...base,
      kind: "RECOVER",
      changed: true,
      week,
      reason: `${signals} Hari ini fokus pulih dengan mobility 20 menit.`.trim(),
      notes,
    };
  }

  // 3. Readiness sedang: turunkan intensitas.
  if (readiness.level === "MODERATE" && isQuality(original.type)) {
    const km = Math.max(3, Math.min(6, round05(original.distanceKm * 0.8)));
    t.originalType = t.originalType ?? original.type;
    t.type = "EASY";
    t.distanceKm = km;
    t.description = describe("EASY", km, input.paces);
    const placed = placeLater(next, { ...original, fromDate: today }, today, input);
    if (placed.placed && placed.placed.originalType !== "REST") {
      // Tukar murni: hari ini mengambil jarak easy run yang digantikan, volume minggu tidak naik.
      const slotKm = input.week.find((w) => w.id === placed.placed!.id)!.distanceKm;
      const tw = placed.week.find((w) => w.id === t.id)!;
      tw.distanceKm = slotKm;
      tw.description = describe("EASY", slotKm, input.paces);
    }
    const where = placed.placed ? `${TYPE(original)} dipindah ke ${formatDateId(placed.placed.date).split(",")[0]}` : `${TYPE(original)} dilepas minggu ini`;
    return {
      ...base,
      kind: "DOWNGRADE",
      changed: true,
      week: placed.week,
      reason: `${signals} ${where}, minggu ini tetap on track.`.trim(),
      notes: [],
    };
  }
  if (readiness.level === "MODERATE" && original.type === "LONG") {
    const km = round05(original.distanceKm * 0.8);
    t.originalType = t.originalType ?? original.type;
    t.distanceKm = km;
    t.description = describe("LONG", km, input.paces);
    return {
      ...base,
      kind: "SHORTEN",
      changed: true,
      week: next,
      reason: `${signals} Long run dipendekkan 20% dan tetap santai.`.trim(),
      notes: [],
    };
  }

  return base;
}

const TYPE = (w: Pick<Workout, "type">) =>
  w.type === "TEMPO" ? "Tempo" : w.type === "INTERVAL" ? "Interval" : w.type === "LONG" ? "Long run" : "Sesi ini";
