import { pgTable, text, integer, doublePrecision, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  // Goal & kondisi awal
  goalType: text("goal_type", { enum: ["10K", "HM", "FM", "RETURN"] }).notNull(),
  raceDate: text("race_date"), // YYYY-MM-DD
  targetPaceSec: integer("target_pace_sec"), // detik/km
  easyPaceSec: integer("easy_pace_sec").notNull(),
  baseWeeklyKm: doublePrecision("base_weekly_km").notNull(),
  weeksOff: integer("weeks_off").notNull().default(0),
  availableDays: text("available_days").notNull(), // CSV 0=Sen..6=Min
  longRunDay: integer("long_run_day").notNull().default(6),
  autonomy: text("autonomy", { enum: ["AUTO", "ASK", "SUGGEST"] }).notNull().default("ASK"),
  latitude: doublePrecision("latitude").notNull().default(-6.2088),
  longitude: doublePrecision("longitude").notNull().default(106.8456),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  // Integrasi Strava
  stravaAthleteId: text("strava_athlete_id"),
  stravaAccessToken: text("strava_access_token"),
  stravaRefreshToken: text("strava_refresh_token"),
  stravaExpiresAt: integer("strava_expires_at"),
  createdAt: createdAt(),
});

export const workouts = pgTable(
  "workouts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD lokal
    week: integer("week").notNull(),
    phase: text("phase", { enum: ["COMEBACK", "BASE", "BUILD", "PEAK", "TAPER"] }).notNull(),
    type: text("type", {
      enum: ["EASY", "TEMPO", "INTERVAL", "LONG", "REST", "STRIDES", "MOBILITY"],
    }).notNull(),
    distanceKm: doublePrecision("distance_km").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: ["PLANNED", "DONE", "SKIPPED", "DROPPED"] })
      .notNull()
      .default("PLANNED"),
    originalDate: text("original_date"),
    originalType: text("original_type"),
    createdAt: createdAt(),
  },
  (t) => [index("workouts_user_date").on(t.userId, t.date)],
);

export const activities = pgTable(
  "activities",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    source: text("source", { enum: ["MANUAL", "STRAVA"] }).notNull().default("MANUAL"),
    externalId: text("external_id"),
    distanceKm: doublePrecision("distance_km").notNull(),
    durationSec: integer("duration_sec").notNull(),
    avgHr: integer("avg_hr"),
    rpe: integer("rpe"),
    pain: text("pain", { enum: ["KNEE", "SHIN_CALF", "OTHER"] }),
    workoutId: text("workout_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_user_date").on(t.userId, t.date),
    uniqueIndex("activities_external").on(t.userId, t.source, t.externalId),
  ],
);

export const dailySignals = pgTable(
  "daily_signals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    sleepHours: doublePrecision("sleep_hours"),
    hrvDeltaPct: doublePrecision("hrv_delta_pct"),
    feeling: text("feeling", { enum: ["FRESH", "OK", "TIRED"] }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("signals_user_date").on(t.userId, t.date)],
);

export const adjustments = pgTable(
  "adjustments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    trigger: text("trigger", { enum: ["DAILY", "SKIP", "SWAP", "CHECKIN"] }).notNull(),
    reason: text("reason").notNull(),
    before: text("before").notNull(), // JSON snapshot untuk Undo
    after: text("after").notNull(),
    status: text("status", { enum: ["PROPOSED", "APPLIED", "REVERTED", "DISMISSED"] })
      .notNull()
      .default("APPLIED"),
    createdAt: createdAt(),
  },
  (t) => [index("adjustments_user_date").on(t.userId, t.date)],
);

export type User = typeof users.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
export type SignalRow = typeof dailySignals.$inferSelect;
export type AdjustmentRow = typeof adjustments.$inferSelect;
