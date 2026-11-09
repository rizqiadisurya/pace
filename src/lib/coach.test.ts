import { beforeAll, describe, expect, it, vi } from "vitest";

// Tanpa internet di test: cuaca dianggap tidak tersedia.
vi.mock("./weather", () => ({ getHourlyConditions: async () => null }));
// Kunci "hari ini" agar test deterministik.
vi.mock("./engine/dates", async (orig) => ({ ...(await orig<typeof import("./engine/dates")>()), todayInTz: () => "2026-11-09" }));

import * as coach from "./coach";
import { spacingViolations } from "./engine";
import { getDb, workouts } from "@/db";
import { and, eq } from "drizzle-orm";

let user: Awaited<ReturnType<typeof coach.createUser>>;

beforeAll(async () => {
  user = await coach.createUser({
    name: "Tes",
    goalType: "HM",
    raceDate: "2027-02-28",
    targetPaceSec: 360,
    easyPaceSec: 420,
    baseWeeklyKm: 20,
    weeksOff: 0,
    availableDays: "0,2,3,5,6",
    longRunDay: 6,
    autonomy: "ASK",
  });
  await coach.createPlan(user, "2026-11-09");
  // Jadikan hari ini sesi tempo agar keputusan agent bisa diuji.
  const db = await getDb();
  await db
    .update(workouts)
    .set({ type: "TEMPO", distanceKm: 6, description: "Tempo" })
    .where(and(eq(workouts.userId, user.id), eq(workouts.date, "2026-11-09")));
});

describe("coach (Postgres via PGlite)", () => {
  it("menyimpan rencana lengkap di database", async () => {
    expect((await coach.getPlan(user.id)).length).toBe(16 * 7);
    expect(await coach.totalWeeksOf(user.id)).toBe(16);
  });

  it("tanpa sinyal: tidak ada perubahan", async () => {
    const b = await coach.getBrief(user);
    expect(b.today?.type).toBe("TEMPO");
    expect(b.adjustment).toBeNull();
    expect(b.readiness.estimated).toBe(true);
  });

  it("tidur kurang → usulan (ASK) → terima → undo", async () => {
    await coach.upsertSignal(user.id, "2026-11-09", { sleepHours: 4.5, hrvDeltaPct: -12 });
    const { adjustment } = await coach.recomputeDaily(user);
    expect(adjustment?.status).toBe("PROPOSED");
    expect((await coach.getBrief(user)).today?.type).toBe("TEMPO"); // belum diterapkan

    await coach.resolveAdjustment(user, adjustment!.id, "accept");
    const after = await coach.getBrief(user);
    expect(after.today?.type).toBe("EASY");
    expect(after.original?.type).toBe("TEMPO");
    expect(spacingViolations(after.week)).toEqual([]);

    await coach.resolveAdjustment(user, adjustment!.id, "undo");
    expect((await coach.getBrief(user)).today?.type).toBe("TEMPO");
    await expect(coach.resolveAdjustment(user, adjustment!.id, "undo")).rejects.toThrow();
  });

  it("swap dan skip tersimpan", async () => {
    const today = (await coach.getBrief(user)).today!;
    const opts = await coach.listSwapOptions(user, today.id);
    expect(opts.length).toBeGreaterThan(0);
    await coach.applySkip(user, today.id);
    const week = await coach.getWeekOf(user.id, "2026-11-09");
    expect(week.find((w) => w.id === today.id)?.status).toBe("SKIPPED");
    expect(spacingViolations(week)).toEqual([]);
  });

  it("check-in nyeri 2x berturut-turut memberi peringatan", async () => {
    await coach.checkIn(user, { date: "2026-11-07", distanceKm: 5, durationSec: 2100, rpe: 5, pain: "KNEE" });
    const r = await coach.checkIn(user, { date: "2026-11-08", distanceKm: 5, durationSec: 2100, rpe: 5, pain: "KNEE" });
    expect(r.feedback).toMatch(/dua kali berturut-turut/);
    expect(await coach.consecutivePainReports(user.id)).toBe(2);
  });

  it("hapus user menghapus semua datanya (cascade)", async () => {
    await coach.deleteUser(user.id);
    expect(await coach.getPlan(user.id)).toEqual([]);
  });
});
