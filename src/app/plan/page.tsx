import { redirect } from "next/navigation";
import { getPlan, todayOf } from "@/lib/coach";
import { DAY_SHORT, dayOfWeek, formatKm, weekKm, workoutTitle, type Workout } from "@/lib/engine";
import { getCurrentUser } from "@/lib/session";
import { TabBar } from "@/components/TabBar";

export const dynamic = "force-dynamic";

const PHASE: Record<string, string> = { COMEBACK: "Comeback", BASE: "Base", BUILD: "Build", PEAK: "Peak", TAPER: "Taper" };

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  const today = todayOf(user);
  const weeks = new Map<number, Workout[]>();
  for (const w of await getPlan(user.id)) weeks.set(w.week, [...(weeks.get(w.week) ?? []), w]);
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Rencana</h1>
        {[...weeks.entries()].map(([n, ws]) => {
          const current = ws.some((w) => w.date === today);
          return (
            <section key={n} className={`rounded-[20px] border bg-surface p-4 ${current ? "border-ink" : "border-line-soft"}`} aria-label={`Minggu ${n}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold">
                  Minggu {n} <span className="font-medium text-muted">· {PHASE[ws[0].phase]}</span>
                </h2>
                <span className="text-[13px] text-muted">{formatKm(weekKm(ws))} km</span>
              </div>
              <ul className="flex flex-col">
                {ws.filter((w) => w.type !== "REST").map((w) => (
                  <li key={w.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-9 text-[13px] font-semibold text-muted">{DAY_SHORT[dayOfWeek(w.date)]}</span>
                    <span className={`flex-1 ${w.status === "SKIPPED" || w.status === "DROPPED" ? "text-muted line-through" : ""} ${w.date === today ? "font-semibold" : ""}`}>
                      {workoutTitle(w)}
                    </span>
                    {w.status === "DONE" && <span className="text-xs font-semibold text-ok">Selesai</span>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      <TabBar />
    </div>
  );
}
