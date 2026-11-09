import { describe, expect, it } from "vitest";
import {
  addDays,
  assessConditions,
  computeReadiness,
  dayOfWeek,
  decideToday,
  generatePlan,
  heatIndexC,
  pacesFor,
  skipWorkout,
  spacingViolations,
  swapOptions,
  validateWeek,
  weekKm,
  weekStart,
  type PlanInput,
  type Readiness,
  type Workout,
} from "./index";

const baseInput: PlanInput = {
  startDate: "2026-11-09", // Senin
  goalType: "HM",
  raceDate: "2027-02-15",
  easyPaceSec: 420,
  targetPaceSec: 360,
  baseWeeklyKm: 20,
  weeksOff: 0,
  availableDays: [0, 2, 3, 5, 6], // Sen, Rab, Kam, Sab, Min
  longRunDay: 6,
};

function withIds(plan: ReturnType<typeof generatePlan>): Workout[] {
  return plan.map((w, i) => ({ ...w, id: `w${i}`, status: "PLANNED" as const }));
}

function byWeek(plan: Workout[]): Workout[][] {
  const m = new Map<number, Workout[]>();
  for (const w of plan) m.set(w.week, [...(m.get(w.week) ?? []), w]);
  return [...m.values()];
}

const GOOD: Readiness = { score: 82, level: "GOOD", factors: [], estimated: false };
const MODERATE = computeReadiness({ sleepHours: 4.67, hrvDeltaPct: -12 });

describe("dates", () => {
  it("dayOfWeek: Senin = 0, Minggu = 6", () => {
    expect(dayOfWeek("2026-11-09")).toBe(0);
    expect(dayOfWeek("2026-11-15")).toBe(6);
    expect(weekStart("2026-11-12")).toBe("2026-11-09");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("generatePlan", () => {
  const plan = withIds(generatePlan(baseInput));
  const weeks = byWeek(plan);

  it("membuat rencana sampai minggu race, satu baris per hari", () => {
    expect(weeks.length).toBe(15);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.at(-1)!.every((w) => w.phase === "TAPER")).toBe(true);
  });

  it("hanya menjadwalkan lari di hari tersedia", () => {
    for (const w of plan) {
      if (w.type !== "REST") expect(baseInput.availableDays).toContain(dayOfWeek(w.date));
    }
  });

  it("long run selalu di hari long run yang dipilih", () => {
    expect(plan.filter((w) => w.type === "LONG").every((w) => dayOfWeek(w.date) === 6)).toBe(true);
  });

  it("tidak pernah melanggar guardrail jarak 48 jam maupun kenaikan volume 10%", () => {
    const history: number[] = [];
    for (const wk of weeks) {
      expect(validateWeek(wk, history)).toEqual([]);
      history.push(weekKm(wk));
    }
  });

  it("comeback mode: 2 minggu pertama tanpa sesi kualitas dan volume setengah", () => {
    const cb = byWeek(withIds(generatePlan({ ...baseInput, weeksOff: 9 })));
    expect(cb[0][0].phase).toBe("COMEBACK");
    expect(cb[1][0].phase).toBe("COMEBACK");
    expect(cb[0].concat(cb[1]).some((w) => w.type === "TEMPO" || w.type === "INTERVAL")).toBe(false);
    expect(weekKm(cb[0])).toBeLessThanOrEqual(12);
  });

  it("tidak membuat sesi sebelum tanggal mulai", () => {
    const mid = generatePlan({ ...baseInput, startDate: "2026-11-12" });
    expect(mid.every((w) => w.date >= "2026-11-12")).toBe(true);
  });

  it("goal RETURN tanpa tanggal race: 8 minggu", () => {
    const r = byWeek(withIds(generatePlan({ ...baseInput, goalType: "RETURN", raceDate: null })));
    expect(r.length).toBe(8);
  });
});

describe("readiness", () => {
  it("tidur 4j40m + HRV −12% → sedang", () => {
    expect(MODERATE.score).toBe(55);
    expect(MODERATE.level).toBe("MODERATE");
    expect(MODERATE.factors.map((f) => f.label)).toEqual(["Tidur 4j 40m", "HRV −12%"]);
  });
  it("tanpa data → estimasi 75", () => {
    const r = computeReadiness({});
    expect(r).toMatchObject({ score: 75, estimated: true, level: "GOOD" });
  });
  it("tidur sangat kurang + capek → rendah", () => {
    expect(computeReadiness({ sleepHours: 4, feeling: "TIRED", hrvDeltaPct: -20 }).level).toBe("LOW");
  });
});

describe("conditions", () => {
  it("heat index di kelembapan Jakarta", () => {
    expect(heatIndexC(32, 75)).toBeGreaterThan(38);
    expect(heatIndexC(25, 80)).toBe(25);
  });
  it("AQI tinggi jam 6 → sarankan jam lain", () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      tempC: h < 8 ? 25 : 32,
      humidity: 80,
      aqi: h === 6 ? 165 : h === 5 ? 98 : 140,
    }));
    const c = assessConditions(hours, 6)!;
    expect(c.flagged).toBe(true);
    expect(c.bestHour).toBe(5);
  });
});

describe("decideToday", () => {
  const plan = withIds(generatePlan(baseInput));
  // Minggu BUILD dengan tempo
  const buildWeek = byWeek(plan).find((wk) => wk.some((w) => w.type === "TEMPO"))!;
  const tempo = buildWeek.find((w) => w.type === "TEMPO")!;
  const ctx = { today: tempo.date, availableDays: baseInput.availableDays, paces: pacesFor(baseInput) };

  it("readiness baik → rencana tetap", () => {
    const d = decideToday({ ...ctx, week: buildWeek, readiness: GOOD, conditions: null, consecutivePainReports: 0 });
    expect(d.kind).toBe("KEEP");
    expect(d.changed).toBe(false);
  });

  it("readiness sedang → tempo jadi easy dan dipindah tanpa melanggar guardrail", () => {
    const d = decideToday({ ...ctx, week: buildWeek, readiness: MODERATE, conditions: null, consecutivePainReports: 0 });
    expect(d.kind).toBe("DOWNGRADE");
    expect(d.week.find((w) => w.id === tempo.id)!.type).toBe("EASY");
    expect(spacingViolations(d.week)).toEqual([]);
    expect(weekKm(d.week)).toBeLessThanOrEqual(weekKm(buildWeek) + 0.01);
    expect(d.reason).toMatch(/^Tidur 4j 40m dan HRV −12%\./);
  });

  it("nyeri 2x berturut-turut → tidak ada sesi kualitas tersisa", () => {
    const d = decideToday({ ...ctx, week: buildWeek, readiness: GOOD, conditions: null, consecutivePainReports: 2 });
    expect(d.kind).toBe("PAIN_STOP");
    expect(d.week.filter((w) => w.date >= ctx.today).some((w) => w.type === "TEMPO" || w.type === "INTERVAL")).toBe(false);
  });
});

describe("skip & swap", () => {
  const plan = withIds(generatePlan(baseInput));
  const peakWeek = byWeek(plan).find((wk) => wk.filter((w) => w.type === "TEMPO" || w.type === "INTERVAL").length === 2)!;
  const ctxFor = (today: string) => ({ today, availableDays: baseInput.availableDays, paces: pacesFor(baseInput) });

  it("skip sesi kualitas tidak pernah menghasilkan sesi berat berdempetan", () => {
    for (const w of peakWeek.filter((x) => x.type !== "REST")) {
      const r = skipWorkout(peakWeek, w.id, ctxFor(w.date));
      expect(r.week.find((x) => x.id === w.id)!.status).toBe("SKIPPED");
      expect(spacingViolations(r.week)).toEqual([]);
      expect(weekKm(r.week)).toBeLessThanOrEqual(weekKm(peakWeek) + 0.01);
    }
  });

  it("swap menawarkan alternatif yang aman", () => {
    const q = peakWeek.find((w) => w.type === "INTERVAL")!;
    const opts = swapOptions(peakWeek, q.id, ctxFor(q.date));
    expect(opts.map((o) => o.key)).toContain("EASY");
    for (const o of opts) expect(spacingViolations(o.week)).toEqual([]);
  });
});
