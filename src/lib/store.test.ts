import { beforeEach, describe, expect, it } from "vitest";
import * as store from "./store";
import { spacingViolations } from "./engine";

// 9 Nov 2026 pukul 06.00 WIB
const NOW = new Date("2026-11-08T23:00:00Z");

function setup(autonomy: store.Autonomy = "ASK") {
  store.__resetForTests();
  const p = store.createProfile(
    {
      name: "Tes",
      goalType: "HM",
      raceDate: "2027-02-28",
      targetPaceSec: 360,
      easyPaceSec: 420,
      baseWeeklyKm: 20,
      weeksOff: 0,
      availableDays: [0, 2, 3, 5, 6],
      longRunDay: 6,
      autonomy,
    },
    NOW,
  );
  // Jadikan hari ini sesi tempo
  const s = store.load();
  const today = s.workouts.find((w) => w.date === "2026-11-09")!;
  Object.assign(today, { type: "TEMPO", distanceKm: 6, description: "Tempo" });
  return p;
}

describe("store (local-first)", () => {
  beforeEach(() => setup());

  it("onboarding membuat profil dan rencana 16 minggu", () => {
    const s = store.load();
    expect(s.profile?.name).toBe("Tes");
    expect(s.workouts.length).toBe(16 * 7);
  });

  it("validasi onboarding", () => {
    expect(() =>
      store.createProfile(
        { name: "", goalType: "HM", raceDate: null, targetPaceSec: null, easyPaceSec: 420, baseWeeklyKm: 10, weeksOff: 0, availableDays: [0, 6], longRunDay: 6, autonomy: "ASK" },
        NOW,
      ),
    ).toThrow(store.PaceError);
  });

  it("tanpa sinyal: tidak ada perubahan", () => {
    const b = store.getBrief(NOW);
    expect(b.today?.type).toBe("TEMPO");
    expect(b.adjustment).toBeNull();
  });

  it("tidur kurang → usulan → terima → undo", () => {
    const adj = store.saveSignal({ sleepHours: 4.5, hrvDeltaPct: -12 }, NOW)!;
    expect(adj.status).toBe("PROPOSED");
    expect(store.getBrief(NOW).today?.type).toBe("TEMPO");
    store.resolveAdjustment(adj.id, "accept");
    const b = store.getBrief(NOW);
    expect(b.today?.type).toBe("EASY");
    expect(b.original?.type).toBe("TEMPO");
    expect(spacingViolations(b.week)).toEqual([]);
    store.resolveAdjustment(adj.id, "undo");
    expect(store.getBrief(NOW).today?.type).toBe("TEMPO");
    expect(() => store.resolveAdjustment(adj.id, "undo")).toThrow();
  });

  it("autonomy AUTO langsung diterapkan", () => {
    store.updateProfile({ autonomy: "AUTO" });
    store.saveSignal({ sleepHours: 4.5, hrvDeltaPct: -12 }, NOW);
    expect(store.getBrief(NOW).today?.type).toBe("EASY");
  });

  it("skip & swap", () => {
    const t = store.getBrief(NOW).today!;
    expect(store.listSwapOptions(t.id).length).toBeGreaterThan(0);
    store.applySkip(t.id);
    const week = store.weekOf(store.load(), "2026-11-09");
    expect(week.find((w) => w.id === t.id)?.status).toBe("SKIPPED");
    expect(spacingViolations(week)).toEqual([]);
  });

  it("check-in nyeri 2x → peringatan, lalu besok sesi berat ditahan", () => {
    store.checkIn({ date: "2026-11-07", distanceKm: 5, durationSec: 2100, rpe: 5, pain: "KNEE" }, NOW);
    const r = store.checkIn({ date: "2026-11-08", distanceKm: 5, durationSec: 2100, rpe: 5, pain: "KNEE" }, NOW);
    expect(r.feedback).toMatch(/dua kali berturut-turut/);
    const adj = store.runDailyAgent(NOW);
    expect(adj?.reason).toMatch(/nyeri/i);
  });

  it("ekspor dan reset", () => {
    expect(JSON.parse(store.exportData()).profile.name).toBe("Tes");
    store.resetAll();
    expect(store.load().profile).toBeNull();
  });
});

describe("dashboard", () => {
  beforeEach(() => setup());

  it("awal: status EARLY, countdown dan fase terisi", () => {
    const d = store.dashboardFrom(store.load(), NOW);
    expect(d.status).toBe("EARLY");
    expect(d.goal.daysLeft).toBe(111); // 9 Nov 2026 → 28 Feb 2027
    expect(d.plan.week).toBe(1);
    expect(d.plan.totalWeeks).toBe(16);
    expect(d.plan.phases.map((p) => p.phase)).toEqual(["BASE", "BUILD", "PEAK", "TAPER"]);
    expect(d.weeks[0].isCurrent).toBe(true);
    expect(d.goal.targetTimeSec).toBeCloseTo(360 * 21.0975);
    expect(d.prediction).toBeNull();
  });

  it("riegel: 10 km 60:00 → HM ±2:12:23", () => {
    expect(Math.round(store.riegel(10, 3600, 21.0975))).toBe(7943);
    expect(store.formatDuration(7943)).toBe("2:12:23");
    expect(store.formatDuration(3130)).toBe("52:10");
  });

  it("menghitung km selesai per minggu, prediksi, dan kepatuhan", () => {
    // tiga lari di minggu lalu (tanggal 7–8 Nov, di luar rencana) + satu sesi hari ini
    store.checkIn({ date: "2026-11-07", distanceKm: 5, durationSec: 1950, rpe: 4 }, NOW);
    store.checkIn({ date: "2026-11-08", distanceKm: 8, durationSec: 3300, rpe: 5 }, NOW);
    const today = store.load().workouts.find((w) => w.date === "2026-11-09")!;
    store.checkIn({ workoutId: today.id, distanceKm: 6, durationSec: 2160, rpe: 6 }, NOW);
    const d = store.dashboardFrom(store.load(), NOW);
    expect(d.weeks[0].doneKm).toBe(6);
    expect(d.totals).toEqual({ runs: 3, km: 19 });
    expect(d.adherence).toEqual({ done: 1, planned: 1, pct: 100 });
    expect(d.prediction?.basedOn.distanceKm).toBe(6);
    expect(d.longRun.longestRecentKm).toBe(8);
    expect(d.streakWeeks).toBe(2);
    expect(d.recent[0].distanceKm).toBe(6);
  });

  it("goal RETURN: tanpa countdown dan prediksi", () => {
    store.__resetForTests();
    store.createProfile(
      { name: "R", goalType: "RETURN", raceDate: null, targetPaceSec: null, easyPaceSec: 450, baseWeeklyKm: 10, weeksOff: 6, availableDays: [1, 3, 5], longRunDay: 5, autonomy: "ASK" },
      NOW,
    );
    const d = store.dashboardFrom(store.load(), NOW);
    expect(d.goal.daysLeft).toBeNull();
    expect(d.goal.raceKm).toBeNull();
    expect(d.prediction).toBeNull();
  });
});

describe("sinkron Garmin/Strava", () => {
  beforeEach(() => setup());
  const garminRun = (over: Partial<store.SyncedActivityIn> = {}): store.SyncedActivityIn => ({
    source: "GARMIN", externalId: "g1", date: "2026-11-09", startLocal: "2026-11-09T05:40:00", name: "Lari pagi",
    distanceKm: 6.1, durationSec: 2040, avgHr: 158, maxHr: 172, trainingLoad: 90, aerobicTE: 3.4, ...over,
  });

  it("lari Garmin menandai sesi hari ini selesai dan meminta RPE", () => {
    const sum = store.importSynced([{ activities: [garminRun()] }], NOW);
    expect(sum).toMatchObject({ newRuns: 1, matchedSessions: 1, merged: 0 });
    const s = store.load();
    expect(s.workouts.find((w) => w.date === "2026-11-09")!.status).toBe("DONE");
    expect(store.pendingRating(s, NOW)?.externalIds).toEqual(["GARMIN:g1"]);
  });

  it("lari yang sama dari Strava digabung, bukan dobel; sinkron ulang idempoten", () => {
    store.importSynced([{ activities: [garminRun()] }], NOW);
    const strava = { ...garminRun(), source: "STRAVA" as const, externalId: "s9", startLocal: "2026-11-09T05:41:30", distanceKm: 6.08 };
    const sum = store.importSynced([{ activities: [strava] }], NOW);
    expect(sum).toMatchObject({ newRuns: 0, merged: 1 });
    expect(store.load().activities).toHaveLength(1);
    expect(store.load().activities[0].externalIds).toEqual(["GARMIN:g1", "STRAVA:s9"]);
    expect(store.importSynced([{ activities: [garminRun(), strava] }], NOW)).toMatchObject({ newRuns: 0, merged: 0 });
  });

  it("lari manual diperbarui dengan angka perangkat, RPE manual tetap", () => {
    const t = store.load().workouts.find((w) => w.date === "2026-11-09")!;
    store.checkIn({ workoutId: t.id, distanceKm: 6, durationSec: 2100, rpe: 6 }, NOW);
    store.importSynced([{ activities: [garminRun()] }], NOW);
    const a = store.load().activities;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ distanceKm: 6.1, durationSec: 2040, rpe: 6, avgHr: 158, source: "GARMIN" });
  });

  it("tidur & HRV dari Garmin mengisi readiness dan memicu usulan agent", () => {
    const sum = store.importSynced(
      [{ activities: [], signals: [{ date: "2026-11-09", sleepHours: 4.6, sleepScore: 52, hrvDeltaPct: -16, hrvStatus: "UNBALANCED", bodyBatteryCharged: 30 }] }],
      NOW,
    );
    expect(sum.signalsUpdated).toBe(1);
    const b = store.briefFrom(store.load(), NOW);
    expect(b.signal?.source).toBe("DEVICE");
    expect(b.readiness.factors.map((f) => f.key)).toEqual(["sleep", "hrv"]);
    expect(b.adjustment?.status).toBe("PROPOSED"); // tempo → easy diusulkan
  });

  it("jawaban tidur manual tidak ditimpa perangkat; HRV ditambahkan", () => {
    store.saveSignal({ sleepHours: 7.5, feeling: "OK" }, NOW);
    store.importSynced([{ activities: [], signals: [{ date: "2026-11-09", sleepHours: 5, sleepScore: 60, hrvDeltaPct: -5, hrvStatus: "BALANCED", bodyBatteryCharged: 50 }] }], NOW);
    const sig = store.load().signals.find((x) => x.date === "2026-11-09")!;
    expect(sig).toMatchObject({ sleepHours: 7.5, hrvDeltaPct: -5, feeling: "OK", source: "MANUAL" });
  });

  it("rateActivity mengisi RPE", () => {
    store.importSynced([{ activities: [garminRun()] }], NOW);
    const a = store.load().activities[0];
    store.rateActivity(a.id, 7, "KNEE");
    expect(store.load().activities[0]).toMatchObject({ rpe: 7, pain: "KNEE" });
    expect(store.pendingRating(store.load(), NOW)).toBeNull();
  });

  it("analisa: easy run dengan HR di atas zona 2 → saran pelankan", () => {
    // jadikan hari ini easy run
    const s = store.load();
    Object.assign(s.workouts.find((w) => w.date === "2026-11-09")!, { type: "EASY", distanceKm: 6 });
    store.importSynced([{ activities: [garminRun()], hrZones: [130, 148, 162, 175, 190] }], NOW);
    const ins = store.insightsFrom(store.load(), NOW);
    const run = ins.find((i) => i.id.startsWith("run-"))!;
    expect(run.title).toMatch(/HR terlalu tinggi/);
    expect(run.tone).toBe("warn");
    expect(ins.some((i) => i.id.startsWith("rpe-"))).toBe(true);
    expect(ins.some((i) => i.id === "next")).toBe(true);
  });
});
