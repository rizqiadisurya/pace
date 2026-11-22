import { describe, expect, it } from "vitest";
import { normalizeGarminActivities, normalizeGarminHrZones, normalizeGarminSignals, normalizeStravaActivities, pickAccessToken } from "./normalize.js";

describe("Garmin", () => {
  it("aktivitas lari dinormalisasi, non-lari dibuang", () => {
    const out = normalizeGarminActivities([
      { activityId: 1, activityName: "Jakarta Lari Pagi", activityType: { typeKey: "running" }, startTimeLocal: "2026-11-20 05:42:10", distance: 6230.5, duration: 2600.2, movingDuration: 2512.7, averageHR: 151.4, maxHR: 170, activityTrainingLoad: 88.6, aerobicTrainingEffect: 3.06 },
      { activityId: 2, activityType: { typeKey: "treadmill_running" }, startTimeLocal: "2026-11-21 19:00:00", distance: 5000, duration: 1800 },
      { activityId: 3, activityType: { typeKey: "cycling" }, startTimeLocal: "2026-11-21 06:00:00", distance: 20000, duration: 3600 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      source: "GARMIN", externalId: "1", date: "2026-11-20", startLocal: "2026-11-20T05:42:10", name: "Jakarta Lari Pagi",
      distanceKm: 6.2, durationSec: 2513, avgHr: 151, maxHr: 170, trainingLoad: 89, aerobicTE: 3.1,
    });
    expect(out[1].durationSec).toBe(1800);
  });

  it("tidur, HRV, dan Body Battery digabung per tanggal", () => {
    const s = normalizeGarminSignals(
      [{ calendarDate: "2026-11-21", sleepTimeSeconds: 16200, sleepScores: { overall: { value: 58 } } }],
      { hrvSummaries: [{ calendarDate: "2026-11-21", lastNightAvg: 42, weeklyAvg: 48, status: "UNBALANCED", baseline: { balancedLow: 45, balancedUpper: 55 } }] },
      [{ date: "2026-11-21", charged: 40 }, { date: "2026-11-22", charged: 70 }],
    );
    expect(s).toEqual([
      { date: "2026-11-21", sleepHours: 4.5, sleepScore: 58, hrvLastNight: 42, hrvBaseline: 50, hrvDeltaPct: -16, hrvStatus: "UNBALANCED", bodyBatteryCharged: 40 },
      { date: "2026-11-22", sleepHours: null, sleepScore: null, hrvLastNight: null, hrvBaseline: null, hrvDeltaPct: null, hrvStatus: null, bodyBatteryCharged: 70 },
    ]);
  });

  it("respons kosong/aneh tidak membuat crash", () => {
    expect(normalizeGarminActivities(null)).toEqual([]);
    expect(normalizeGarminSignals(null, {}, "x")).toEqual([]);
    expect(normalizeGarminSignals({ calendarDate: "2026-11-21", sleepTimeSeconds: 25200 }, null, null)[0].sleepHours).toBe(7);
  });

  it("zona HR lari", () => {
    expect(
      normalizeGarminHrZones([
        { sport: "DEFAULT", zone1Floor: 95, zone2Floor: 114, zone3Floor: 133, zone4Floor: 152, zone5Floor: 171, maxHeartRateUsed: 190 },
        { sport: "RUNNING", zone1Floor: 96, zone2Floor: 116, zone3Floor: 135, zone4Floor: 154, zone5Floor: 173, maxHeartRateUsed: 192 },
      ]),
    ).toEqual([116, 135, 154, 173, 192]);
    expect(normalizeGarminHrZones([])).toBeNull();
  });

  it("token: berbagai format", () => {
    expect(pickAccessToken({ access_token: "abc" })).toBe("abc");
    expect(pickAccessToken({ accessToken: "def" })).toBe("def");
    expect(pickAccessToken("x".repeat(40))).toBe("x".repeat(40));
    expect(pickAccessToken({})).toBeNull();
  });
});

describe("Strava", () => {
  it("lari dinormalisasi dari waktu lokal", () => {
    const out = normalizeStravaActivities([
      { id: 99, name: "Morning Run", sport_type: "Run", start_date_local: "2026-11-20T05:43:02Z", distance: 6215.2, moving_time: 2520, average_heartrate: 150.8, max_heartrate: 169 },
      { id: 100, sport_type: "Ride", start_date_local: "2026-11-20T07:00:00Z", distance: 20000, moving_time: 3000 },
      { id: 101, sport_type: "TrailRun", start_date_local: "2026-11-21T06:00:00Z", distance: 8000, moving_time: 3600 },
    ]);
    expect(out.map((a) => a.externalId)).toEqual(["99", "101"]);
    expect(out[0]).toMatchObject({ date: "2026-11-20", startLocal: "2026-11-20T05:43:02", distanceKm: 6.2, durationSec: 2520, avgHr: 151 });
  });
});
