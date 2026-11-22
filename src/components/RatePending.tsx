"use client";
import { useState } from "react";
import { DAY_LONG, dayOfWeek, formatKm, formatPace } from "@/lib/engine";
import { rateActivity, type Activity, type Pain } from "@/lib/store";
import { useRun } from "@/lib/usePace";
import { Card } from "./ui";

const PAIN: { v: Pain | null; l: string }[] = [
  { v: null, l: "Tidak nyeri" },
  { v: "KNEE", l: "Lutut" },
  { v: "SHIN_CALF", l: "Betis" },
  { v: "OTHER", l: "Lainnya" },
];

/** Minta RPE untuk lari yang masuk dari Garmin/Strava (perangkat tidak tahu seberapa berat rasanya). */
export function RatePending({ activity, today }: { activity: Activity; today: string }) {
  const { run, error } = useRun();
  const [pain, setPain] = useState<Pain | null>(null);
  const when = activity.date === today ? "tadi" : DAY_LONG[dayOfWeek(activity.date)];
  return (
    <Card className="flex flex-col gap-3" >
      <div id="rpe" className="scroll-mt-4">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Dari {activity.source === "GARMIN" ? "Garmin" : "Strava"}</p>
        <h2 className="text-[15px] font-semibold">
          Lari {when}: {formatKm(activity.distanceKm)} km · {formatPace(activity.durationSec / activity.distanceKm)}/km
          {activity.avgHr ? ` · HR ${activity.avgHr}` : ""}
        </h2>
        <p className="text-[13px] text-muted">Seberat apa rasanya? 1 = santai sekali, 10 = habis-habisan.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nyeri">
        {PAIN.map((p) => (
          <button
            key={p.l}
            aria-pressed={pain === p.v}
            onClick={() => setPain(p.v)}
            className={`h-9 rounded-full px-3 text-[13px] ${pain === p.v ? "bg-ink font-semibold text-white" : "border border-line bg-surface"}`}
          >
            {p.l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            aria-label={`RPE ${n}`}
            onClick={() => run(() => rateActivity(activity.id, n, pain))}
            className="h-11 rounded-xl border border-line bg-bg text-[15px] font-semibold active:bg-accent active:text-white"
          >
            {n}
          </button>
        ))}
      </div>
      {error && <p className="text-[13px] text-accent-ink">{error}</p>}
    </Card>
  );
}
