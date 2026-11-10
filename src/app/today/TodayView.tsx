"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { applySwap, listSwapOptions, resolveAdjustment, saveSignal, type Brief } from "@/lib/store";
import { useRun, useTimeAdvice } from "@/lib/usePace";
import { DAY_SHORT, TYPE_LABEL, dayOfWeek, formatDateId, formatKm, formatPace, isRun, workoutTitle, type Workout } from "@/lib/engine";
import type { Feeling } from "@/lib/engine/readiness";
import { Button, Card, Chip } from "@/components/ui";
import { IconCheck, IconRefresh, IconWind } from "@/components/icons";

export function TodayView({ brief, greeting }: { brief: Brief; greeting: string }) {
  const { today, adjustment } = brief;
  const [editingSignal, setEditingSignal] = useState(false);
  const advice = useTimeAdvice(brief.location.lat, brief.location.lon, brief.location.timezone, brief.date);
  const showCheckIn = (!brief.hasSignalToday || editingSignal) && today?.status !== "DONE";

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
      <header>
        <p className="text-[13px] font-medium text-muted">
          {formatDateId(brief.date)}
          {brief.weekNumber ? ` · Minggu ${brief.weekNumber} dari ${brief.totalWeeks}` : ""}
        </p>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">
          {greeting}, {brief.user.name}
        </h1>
      </header>

      {showCheckIn ? (
        <CheckInSignal initialSleep={brief.signal?.sleepHours ?? null} onDone={() => setEditingSignal(false)} />
      ) : brief.hasSignalToday ? (
        <ReadinessCard r={brief.readiness} onEdit={today?.status === "DONE" ? undefined : () => setEditingSignal(true)} />
      ) : null}

      {today ? (
        <TodayCard brief={brief} today={today} />
      ) : (
        <Card>
          <p className="text-[15px] font-semibold">Tidak ada sesi terjadwal hari ini.</p>
          <p className="mt-1 text-sm text-muted">Rencanamu mungkin sudah selesai. Buat rencana baru dari halaman Profil.</p>
        </Card>
      )}

      {adjustment?.status === "APPLIED" && today?.status === "PLANNED" && <UndoLink id={adjustment.id} />}

      {advice && today && isRun(today.type) && today.status === "PLANNED" && (
        <div className="flex items-start gap-2.5 rounded-[14px] bg-accent-soft px-3.5 py-3 text-[13px] leading-snug text-accent-ink" role="note">
          <IconWind size={18} className="mt-px shrink-0" />
          <span>{advice}</span>
        </div>
      )}

      <WeekStrip week={brief.week} today={brief.date} />
    </main>
  );
}

// ---------- Check-in pagi: satu pertanyaan per langkah, satu tap per jawaban ----------

const SLEEPS = [
  { v: 4.5, l: "< 5 jam" },
  { v: 5.5, l: "5–6" },
  { v: 6.5, l: "6–7" },
  { v: 7.5, l: "7–8" },
  { v: 8.5, l: "8+" },
];
const FEELINGS: { v: Feeling; l: string }[] = [
  { v: "FRESH", l: "Segar" },
  { v: "OK", l: "Biasa" },
  { v: "TIRED", l: "Capek" },
];

function CheckInSignal({ initialSleep, onDone }: { initialSleep: number | null; onDone: () => void }) {
  const { run, error } = useRun();
  const [sleep, setSleep] = useState<number | null>(initialSleep);
  const [step, setStep] = useState<"sleep" | "feeling">("sleep");
  const chip = "h-11 rounded-xl border border-line bg-bg text-[14px] font-semibold active:bg-ink active:text-white";

  const finish = (feeling: Feeling | null) => {
    if (run(() => saveSignal({ sleepHours: sleep, feeling })) !== null) onDone();
  };

  return (
    <Card className="flex flex-col gap-3">
      {step === "sleep" ? (
        <>
          <div>
            <h2 className="text-[15px] font-semibold">Semalam tidur berapa jam?</h2>
            <p className="text-[13px] text-muted">Pace menyesuaikan sesi hari ini dari jawabanmu.</p>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SLEEPS.map((s) => (
              <button
                key={s.v}
                className={`${chip} ${sleep === s.v ? "border-ink bg-ink text-white" : ""}`}
                aria-pressed={sleep === s.v}
                onClick={() => {
                  setSleep(s.v);
                  setStep("feeling");
                }}
              >
                {s.l}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Badanmu terasa…</h2>
            <button className="-my-3 min-h-11 text-[13px] font-medium text-muted" onClick={() => setStep("sleep")}>
              Ubah jam tidur
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {FEELINGS.map((f) => (
              <button key={f.v} className={chip} onClick={() => finish(f.v)}>
                {f.l}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="text-[13px] text-accent-ink">{error}</p>}
    </Card>
  );
}

function ReadinessCard({ r, onEdit }: { r: Brief["readiness"]; onEdit?: () => void }) {
  const C = 2 * Math.PI * 36;
  const color = r.level === "GOOD" ? "#047857" : r.level === "MODERATE" ? "#c2410c" : "#9a3412";
  return (
    <Card className="flex items-center gap-4">
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Readiness ${r.score} dari 100`}>
          <circle cx="42" cy="42" r="36" fill="none" stroke="#efede7" strokeWidth="8" />
          <circle
            cx="42"
            cy="42"
            r="36"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(r.score / 100) * C} ${C}`}
            transform="rotate(-90 42 42)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[26px] font-bold leading-none">{r.score}</span>
          <span className="text-[11px] text-muted">readiness</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold">{r.label}</span>
          {onEdit && (
            <button onClick={onEdit} className="-my-3 min-h-11 text-[13px] font-medium text-muted underline underline-offset-2">
              Ubah
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.factors.map((f) => (
            <Chip key={f.key} tone={f.impact < 0 ? "warn" : f.impact > 0 ? "ok" : "neutral"}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------- Kartu sesi hari ini: satu sumber kebenaran ----------

function paceLine(brief: Brief, w: Workout): { label: string; value: string } {
  const p = brief.paces;
  if (w.type === "TEMPO") return { label: "Pace tempo", value: `${formatPace(p.tempoPaceSec)}/km` };
  if (w.type === "INTERVAL") return { label: "Pace interval", value: `${formatPace(p.intervalPaceSec)}/km` };
  if (w.type === "LONG") return { label: "Pace", value: `${formatPace(p.easyPaceSec + 15)}–${formatPace(p.easyPaceSec + 45)}` };
  return { label: "Pace", value: `${formatPace(p.easyPaceSec)}–${formatPace(p.easyPaceSec + 30)}` };
}

const shortType = (w: Workout) => (w.type === "LONG" ? "long run" : TYPE_LABEL[w.type].split(" ")[0].toLowerCase());

function TodayCard({ brief, today }: { brief: Brief; today: Workout }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const { run, error } = useRun();
  const adj = brief.adjustment;
  const proposal = adj?.status === "PROPOSED" && adj.proposed ? adj.proposed : null;
  const applied = adj?.status === "APPLIED" && brief.original ? brief.original : null;
  const changed = applied && (applied.type !== today.type || applied.distanceKm !== today.distanceKm) ? applied : null;
  const shown = proposal ?? today; // sesi yang sedang dibicarakan kartu
  const struck = proposal ? today : changed;
  const done = today.status === "DONE";
  const skipped = today.status === "SKIPPED";

  let tag: React.ReactNode = null;
  if (done)
    tag = (
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6ee7b7]">
        <IconCheck size={16} /> Selesai hari ini
      </span>
    );
  else if (proposal)
    tag = (
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-light">
        <IconRefresh size={16} /> {brief.user.autonomy === "SUGGEST" ? "Saran Pace" : "Pace mengusulkan"}
      </span>
    );
  else if (changed)
    tag = (
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-light">
        <IconRefresh size={16} /> Disesuaikan hari ini
      </span>
    );

  const reason = proposal || changed ? adj!.reason : null;
  const act = brief.doneActivity;

  return (
    <section className="flex flex-col gap-3.5 rounded-[24px] bg-ink p-5 text-white" aria-label="Sesi hari ini">
      {tag}
      <div className="flex flex-col gap-1">
        {struck && !done && <span className="text-sm text-dark-muted line-through">{workoutTitle(struck)}</span>}
        <h2 className="font-display text-[32px] font-semibold leading-tight tracking-tight">{workoutTitle(shown)}</h2>
      </div>

      {done ? (
        <p className="text-sm leading-relaxed text-[#d4d6da]">
          {act
            ? `${formatKm(act.distanceKm)} km · ${formatPace(act.durationSec / act.distanceKm)}/km${act.rpe ? ` · RPE ${act.rpe}` : ""}. `
            : ""}
          Istirahat yang cukup, sampai besok.
        </p>
      ) : (
        <>
          {reason && <p className="text-[15px] leading-relaxed text-white">{reason}</p>}
          <p className={`leading-relaxed ${reason ? "text-[13px] text-dark-muted" : "text-sm text-[#d4d6da]"}`}>
            {skipped ? "Hari ini istirahat. Minggu ini sudah disusun ulang." : shown.description}
          </p>
        </>
      )}

      {!done && !skipped && isRun(shown.type) && (
        <div className="grid grid-cols-3 gap-2">
          <Tile label={paceLine(brief, shown).label} value={paceLine(brief, shown).value} />
          <Tile label="Jarak" value={`${formatKm(shown.distanceKm)} km`} />
          <Tile label="Zona HR" value={shown.type === "TEMPO" || shown.type === "INTERVAL" ? "Z3–Z4" : "Z2"} />
        </div>
      )}

      {proposal ? (
        <div className="flex gap-2">
          <Button variant="onDark" className="flex-1 px-3" onClick={() => run(() => resolveAdjustment(adj!.id, "dismiss"))}>
            Tetap {shortType(today)}
          </Button>
          <Button className="flex-[1.3]" onClick={() => run(() => resolveAdjustment(adj!.id, "accept"))}>
            Terima usulan
          </Button>
        </div>
      ) : (
        !done &&
        !skipped &&
        isRun(today.type) && (
          <div className="flex gap-2">
            <Button variant="onDark" className="flex-1" onClick={() => setSwapOpen(true)}>
              Ganti
            </Button>
            <Link
              href={`/today/skip?id=${today.id}`}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-[14px] border border-dark-line text-[15px] font-semibold hover:bg-dark-2"
            >
              Lewati
            </Link>
            <Link
              href={`/checkin?workout=${today.id}`}
              className="inline-flex h-12 flex-[1.4] items-center justify-center rounded-[14px] bg-accent text-[15px] font-semibold hover:bg-accent-hover"
            >
              Selesai lari
            </Link>
          </div>
        )
      )}
      {error && <p className="text-[13px] text-accent-light">{error}</p>}
      {swapOpen && <SwapSheet workoutId={today.id} current={workoutTitle(today)} onClose={() => setSwapOpen(false)} />}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-dark-2 p-2.5">
      <span className="text-[11px] text-dark-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function UndoLink({ id }: { id: string }) {
  const { run } = useRun();
  return (
    <button onClick={() => run(() => resolveAdjustment(id, "undo"))} className="min-h-11 self-center text-[13px] font-medium text-accent underline underline-offset-2">
      Kembalikan ke rencana awal
    </button>
  );
}

function SwapSheet({ workoutId, current, onClose }: { workoutId: string; current: string; onClose: () => void }) {
  const { run, error } = useRun();
  // Dihitung sekali saat sheet dibuka; jangan memanggil run() saat render (setState di render → crash).
  const options = useMemo(() => {
    try {
      return listSwapOptions(workoutId);
    } catch {
      return [];
    }
  }, [workoutId]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="swap-title" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),24px)] text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <h3 id="swap-title" className="text-lg font-semibold">
          Ganti sesi hari ini
        </h3>
        <p className="mb-3 text-[13px] text-muted">Sekarang: {current}</p>
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                if (run(() => applySwap(workoutId, o.key)) !== null) onClose();
              }}
              className="rounded-2xl border border-line p-3.5 text-left hover:bg-bg active:bg-chip"
            >
              <span className="block text-[15px] font-semibold">{o.label}</span>
              <span className="block text-[13px] text-muted">{o.detail}</span>
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-[13px] text-accent-ink">{error}</p>}
        <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
          Batal
        </Button>
      </div>
    </div>
  );
}

// ---------- Strip minggu ----------

function WeekStrip({ week, today }: { week: Workout[]; today: string }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label="Minggu ini">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-muted">Minggu ini</h2>
        <Link href="/plan" className="-my-3 py-3 text-[13px] font-medium text-accent">
          Lihat rencana
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, d) => {
          const w = week.find((x) => dayOfWeek(x.date) === d);
          const isToday = w?.date === today;
          const moved = !!w?.originalType || !!w?.originalDate;
          const off = !w || w.type === "REST" || w.type === "MOBILITY" || w.status === "SKIPPED" || w.status === "DROPPED";
          const label = off ? "—" : formatKm(w!.distanceKm);
          const dot = w?.status === "DONE" ? "bg-ok" : moved && !off ? "bg-accent" : "bg-transparent";
          return (
            <div
              key={d}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 ${isToday ? "border-[1.5px] border-ink bg-surface" : "border-[1.5px] border-transparent bg-chip"}`}
              aria-label={`${DAY_SHORT[d]}: ${w ? workoutTitle(w) : "kosong"}${w?.status === "DONE" ? ", selesai" : moved ? ", dipindah" : ""}`}
            >
              <span className="text-[11px] text-muted">{DAY_SHORT[d]}</span>
              <span className={`text-[13px] font-semibold tabular-nums ${off ? "text-muted" : ""}`}>{label}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 text-[11px] text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Selesai
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Dipindah
        </span>
        <span>Angka = km</span>
      </div>
    </section>
  );
}
