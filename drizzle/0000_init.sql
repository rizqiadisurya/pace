CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"external_id" text,
	"distance_km" double precision NOT NULL,
	"duration_sec" integer NOT NULL,
	"avg_hr" integer,
	"rpe" integer,
	"pain" text,
	"workout_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"trigger" text NOT NULL,
	"reason" text NOT NULL,
	"before" text NOT NULL,
	"after" text NOT NULL,
	"status" text DEFAULT 'APPLIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"sleep_hours" double precision,
	"hrv_delta_pct" double precision,
	"feeling" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"goal_type" text NOT NULL,
	"race_date" text,
	"target_pace_sec" integer,
	"easy_pace_sec" integer NOT NULL,
	"base_weekly_km" double precision NOT NULL,
	"weeks_off" integer DEFAULT 0 NOT NULL,
	"available_days" text NOT NULL,
	"long_run_day" integer DEFAULT 6 NOT NULL,
	"autonomy" text DEFAULT 'ASK' NOT NULL,
	"latitude" double precision DEFAULT -6.2088 NOT NULL,
	"longitude" double precision DEFAULT 106.8456 NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"strava_athlete_id" text,
	"strava_access_token" text,
	"strava_refresh_token" text,
	"strava_expires_at" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"week" integer NOT NULL,
	"phase" text NOT NULL,
	"type" text NOT NULL,
	"distance_km" double precision NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"original_date" text,
	"original_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_signals" ADD CONSTRAINT "daily_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_date" ON "activities" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_external" ON "activities" USING btree ("user_id","source","external_id");--> statement-breakpoint
CREATE INDEX "adjustments_user_date" ON "adjustments" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_user_date" ON "daily_signals" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "workouts_user_date" ON "workouts" USING btree ("user_id","date");