export type Feeling = "FRESH" | "OK" | "TIRED";

export interface ReadinessInput {
  sleepHours?: number | null;
  hrvDeltaPct?: number | null;
  feeling?: Feeling | null;
  /** RPE dari lari kemarin (1–10), jika ada */
  yesterdayRpe?: number | null;
  /** Rasio beban 7 hari / rata-rata mingguan 4 minggu (acute:chronic) */
  loadRatio?: number | null;
}

export interface ReadinessFactor {
  key: "sleep" | "hrv" | "feeling" | "rpe" | "load";
  label: string;
  impact: number;
}

export type ReadinessLevel = "GOOD" | "MODERATE" | "LOW";

export interface Readiness {
  score: number;
  level: ReadinessLevel;
  factors: ReadinessFactor[];
  /** true jika tidak ada data sama sekali; skor default dipakai */
  estimated: boolean;
}

const fmtHours = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}j ${mm}m` : `${hh}j`;
};

/** Skor readiness 0–100. Rule-based dan transparan: setiap faktor punya label untuk ditampilkan. */
export function computeReadiness(input: ReadinessInput): Readiness {
  const factors: ReadinessFactor[] = [];
  let score = 80;

  if (input.sleepHours != null) {
    const h = input.sleepHours;
    const impact = h < 5 ? -15 : h < 6 ? -10 : h < 7 ? -5 : h >= 8 ? 5 : 0;
    factors.push({ key: "sleep", label: `Tidur ${fmtHours(h)}`, impact });
  }
  if (input.hrvDeltaPct != null) {
    const d = input.hrvDeltaPct;
    const impact = d <= -15 ? -15 : d <= -8 ? -10 : d >= 5 ? 5 : 0;
    factors.push({ key: "hrv", label: `HRV ${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(Math.round(d))}%`, impact });
  }
  if (input.feeling) {
    const impact = input.feeling === "TIRED" ? -15 : input.feeling === "FRESH" ? 5 : 0;
    const label = input.feeling === "TIRED" ? "Merasa capek" : input.feeling === "FRESH" ? "Merasa segar" : "Merasa biasa";
    factors.push({ key: "feeling", label, impact });
  }
  if (input.yesterdayRpe != null && input.yesterdayRpe >= 8) {
    factors.push({ key: "rpe", label: `Kemarin RPE ${input.yesterdayRpe}`, impact: -10 });
  }
  if (input.loadRatio != null && input.loadRatio > 1.3) {
    factors.push({ key: "load", label: "Beban minggu ini tinggi", impact: -10 });
  }

  const estimated = factors.length === 0;
  for (const f of factors) score += f.impact;
  if (estimated) score = 75;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: ReadinessLevel = score >= 70 ? "GOOD" : score >= 50 ? "MODERATE" : "LOW";
  return { score, level, factors, estimated };
}

export const LEVEL_LABEL: Record<ReadinessLevel, string> = {
  GOOD: "Siap latihan",
  MODERATE: "Pulih sebagian",
  LOW: "Butuh pemulihan",
};
