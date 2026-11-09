import { z } from "zod";

const pace = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Format pace mm:ss")
  .transform((s) => {
    const [m, sec] = s.split(":").map(Number);
    return m * 60 + sec;
  })
  .refine((v) => v >= 150 && v <= 900, "Pace di luar rentang wajar (2:30–15:00/km)");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(40),
  goalType: z.enum(["10K", "HM", "FM", "RETURN"]),
  raceDate: isoDate.nullish(),
  targetPace: pace.nullish(),
  easyPace: pace,
  baseWeeklyKm: z.number().min(0).max(200),
  weeksOff: z.number().int().min(0).max(104),
  availableDays: z.array(z.number().int().min(0).max(6)).min(2, "Pilih minimal 2 hari").max(7),
  longRunDay: z.number().int().min(0).max(6),
  autonomy: z.enum(["AUTO", "ASK", "SUGGEST"]).default("ASK"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().optional(),
});

export const signalSchema = z.object({
  sleepHours: z.number().min(0).max(16).nullish(),
  hrvDeltaPct: z.number().min(-80).max(80).nullish(),
  feeling: z.enum(["FRESH", "OK", "TIRED"]).nullish(),
});

export const checkInSchema = z.object({
  workoutId: z.string().nullish(),
  date: isoDate.optional(),
  distanceKm: z.number().positive().max(100),
  durationSec: z.number().int().positive().max(60 * 60 * 12),
  avgHr: z.number().int().min(60).max(230).nullish(),
  rpe: z.number().int().min(1).max(10),
  pain: z.enum(["KNEE", "SHIN_CALF", "OTHER"]).nullish(),
});

export const adjustmentActionSchema = z.object({ action: z.enum(["accept", "dismiss", "undo"]) });
export const swapSchema = z.object({ key: z.enum(["EASY", "SHORTER", "TREADMILL", "MOBILITY", "SWAP_LATER"]) });
export const meSchema = z.object({
  autonomy: z.enum(["AUTO", "ASK", "SUGGEST"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
