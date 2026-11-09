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
