"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Brief } from "@/lib/coach";
import { DAY_SHORT, dayOfWeek, formatDateId, formatKm, formatPace, isRun, workoutTitle, type Workout } from "@/lib/engine";
import { Button, Card, Chip } from "@/components/ui";
import { IconCheck, IconRefresh, IconWind } from "@/components/icons";
import { useAction } from "@/components/useAction";

export function TodayView({ brief, greeting }: { brief: Brief; greeting: string }) {
  const { today, adjustment, original } = brief;
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted">
            {formatDateId(brief.date)}
            {brief.weekNumber ? ` · Minggu ${brief.weekNumber} dari ${brief.totalWeeks}` : ""}
          </p>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">
            {greeting}, {brief.user.name}
          </h1>
        </div>
      </header>

      {!brief.hasSignalToday && <SignalCard />}
      <ReadinessCard r={brief.readiness} />
      {adjustment?.status === "PROPOSED" && adjustment.proposed && (
        <ProposalCard id={adjustment.id} reason={adjustment.reason} proposed={adjustment.proposed} suggestOnly={brief.user.autonomy === "SUGGEST"} />
      )}
      {today ? (
        <TodayCard brief={brief} today={today} original={original} />
      ) : (
        <Card>
          <p className="text-[15px] font-semibold">Tidak ada sesi terjadwal hari ini.</p>
          <p className="mt-1 text-sm text-muted">Rencanamu mungkin sudah selesai. Buat rencana baru dari halaman Profil.</p>
        </Card>
      )}
      {adjustment?.status === "APPLIED" && <UndoLink id={adjustment.id} />}
      {brief.timeAdvice && (
        <div className="flex items-start gap-2.5 rounded-[14px] bg-accent-soft px-3.5 py-3 text-[13px] leading-snug text-accent-ink">
          <IconWind size={18} className="mt-px shrink-0" />
          <span>{brief.timeAdvice}</span>
        </div>
      )}
      <WeekStrip week={brief.week} today={brief.date} />
    </main>
  );
}

function SignalCard() {
  const { call, pending, error } = useAction();
  const [sleep, setSleep] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<"FRESH" | "OK" | "TIRED" | null>(null);
  const sleeps = [
    { v: 4.5, l: "< 5j" },
    { v: 5.5, l: "5–6j" },
    { v: 6.5, l: "6–7j" },
    { v: 7.5, l: "7–8j" },
    { v: 8.5, l: "8j+" },
  ];
  const feelings = [
    { v: "FRESH" as const, l: "Segar" },
    { v: "OK" as const, l: "Biasa" },
    { v: "TIRED" as const, l: "Capek" },
  ];
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Semalam tidur berapa jam?</h2>
        <p className="text-[13px] text-muted">Pace memakai ini untuk menyesuaikan sesi hari ini.</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Jam tidur">
        {sleeps.map((s) => (
          <button
            key={s.v}
            role="radio"
            aria-checked={sleep === s.v}
            onClick={() => setSleep(s.v)}
            className={`h-11 rounded-xl text-[13px] font-semibold ${sleep === s.v ? "bg-ink text-white" : "border border-line bg-bg"}`}
          >
            {s.l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Perasaan">
        {feelings.map((f) => (
          <button
            key={f.v}
            role="radio"
            aria-checked={feeling === f.v}
            onClick={() => setFeeling(f.v)}
            className={`h-11 rounded-xl text-[13px] font-semibold ${feeling === f.v ? "bg-ink text-white" : "border border-line bg-bg"}`}
          >
            {f.l}
          </button>
        ))}
      </div>
      {error && <p className="text-[13px] text-accent-ink">{error}</p>}
      <Button disabled={pending || (sleep === null && feeling === null)} onClick={() => call("/api/signals", { json: { sleepHours: sleep, feeling } })}>
        Simpan
      </Button>
    </Card>
  );
}

function ReadinessCard({ r }: { r: Brief["readiness"] }) {
  const C = 2 * Math.PI * 36;
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
            stroke={r.level === "GOOD" ? "#047857" : "#c2410c"}
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
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-[15px] font-semibold">{r.label}</span>
        <div className="flex flex-wrap gap-1.5">
          {r.factors.map((f) => (
            <Chip key={f.key} tone={f.impact < 0 ? "warn" : f.impact > 0 ? "ok" : "neutral"}>
              {f.label}
            </Chip>
          ))}
          {r.estimated && <span className="text-xs text-muted">Estimasi. Isi jam tidur untuk skor lebih akurat.</span>}
        </div>
      </div>
    </Card>
  );
}

function paceLine(brief: Brief, w: Workout): { label: string; value: string } {
  const p = brief.paces;
  if (w.type === "TEMPO") return { label: "Pace tempo", value: `${formatPace(p.tempoPaceSec)}/km` };
  if (w.type === "INTERVAL") return { label: "Pace interval", value: `${formatPace(p.intervalPaceSec)}/km` };
  if (w.type === "LONG") return { label: "Pace", value: `${formatPace(p.easyPaceSec + 15)}–${formatPace(p.easyPaceSec + 45)}` };
  return { label: "Pace", value: `${formatPace(p.easyPaceSec)}–${formatPace(p.easyPaceSec + 30)}` };
}

function TodayCard({ brief, today, original }: { brief: Brief; today: Workout; original: Workout | null }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const changed = original && (original.type !== today.type || original.distanceKm !== today.distanceKm);
  const done = today.status === "DONE";
  const skipped = today.status === "SKIPPED";
  const run = isRun(today.type);

  return (
    <section className="flex flex-col gap-3.5 rounded-[24px] bg-ink p-5 text-white" aria-label="Sesi hari ini">
      {changed && (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-light">
          <IconRefresh size={16} /> Disesuaikan hari ini
        </div>
      )}
      <div className="flex flex-col gap-1">
        {changed && <span className="text-sm text-dark-muted line-through">{workoutTitle(original!)}</span>}
        <h2 className="font-display text-[32px] font-semibold leading-tight tracking-tight">{workoutTitle(today)}</h2>
      </div>
      <p className="text-sm leading-relaxed text-[#d4d6da]">
        {changed && brief.adjustment?.status === "APPLIED" ? brief.adjustment.reason : today.description}
      </p>
      {changed && <p className="text-[13px] leading-relaxed text-dark-muted">{today.description}</p>}

      {done ? (
        <div className="flex items-center gap-2 rounded-xl bg-dark-2 p-3 text-sm font-semibold">
          <IconCheck size={18} className="text-[#6ee7b7]" /> Selesai. Mantap!
        </div>
      ) : skipped ? (
        <div className="rounded-xl bg-dark-2 p-3 text-sm text-dark-muted">Hari ini istirahat. Minggu ini sudah disusun ulang.</div>
      ) : run ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Tile label={paceLine(brief, today).label} value={paceLine(brief, today).value} />
            <Tile label="Jarak" value={`${formatKm(today.distanceKm)} km`} />
            <Tile label="Zona HR" value={today.type === "TEMPO" || today.type === "INTERVAL" ? "Z3–Z4" : "Z2"} />
          </div>
          <div className="flex gap-2">
            <Button variant="onDark" className="flex-1" onClick={() => setSwapOpen(true)}>
              Swap
            </Button>
            <Link
              href={`/today/skip/${today.id}`}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-[14px] border border-dark-line text-[15px] font-semibold hover:bg-dark-2"
            >
              Skip
            </Link>
            <Link
              href={`/checkin?workout=${today.id}`}
              className="inline-flex h-12 flex-[1.4] items-center justify-center rounded-[14px] bg-accent text-[15px] font-semibold hover:bg-accent-hover"
            >
              Catat lari
            </Link>
          </div>
        </>
      ) : null}
      {swapOpen && <SwapSheet workoutId={today.id} onClose={() => setSwapOpen(false)} />}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-dark-2 p-2.5">
      <span className="text-[11px] text-dark-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function ProposalCard({ id, reason, proposed, suggestOnly }: { id: string; reason: string; proposed: Workout; suggestOnly: boolean }) {
  const { call, pending, error } = useAction();
  return (
    <Card className="flex flex-col gap-3 border-accent/30">
      <span className="text-xs font-semibold uppercase tracking-wider text-accent">{suggestOnly ? "Saran Pace" : "Pace mengusulkan"}</span>
      <p className="font-display text-xl font-semibold">{workoutTitle(proposed)}</p>
      <p className="text-sm leading-relaxed text-muted">{reason}</p>
      {error && <p className="text-[13px] text-accent-ink">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={pending} onClick={() => call(`/api/adjustments/${id}`, { json: { action: "dismiss" } })}>
          Tetap rencana awal
        </Button>
        <Button className="flex-1" disabled={pending} onClick={() => call(`/api/adjustments/${id}`, { json: { action: "accept" } })}>
          Terima
        </Button>
      </div>
    </Card>
  );
}

function UndoLink({ id }: { id: string }) {
  const { call, pending } = useAction();
  return (
    <button
      disabled={pending}
      onClick={() => call(`/api/adjustments/${id}`, { json: { action: "undo" } })}
      className="min-h-11 self-center text-[13px] font-medium text-accent underline underline-offset-2"
    >
      Kembalikan ke rencana awal
    </button>
  );
}

function SwapSheet({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const { call, pending, error } = useAction();
  const [options, setOptions] = useState<{ key: string; label: string; detail: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/workouts/${workoutId}/swap`)
      .then((r) => r.json())
      .then((d) => alive && setOptions(d.options ?? []))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [workoutId]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" role="dialog" aria-modal="true" aria-label="Pilih alternatif" onClick={onClose}>
      <div className="mx-auto w-full max-w-md rounded-t-3xl bg-surface p-5 pb-8 text-ink" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold">Ganti sesi hari ini</h3>
        {options === null && <p className="text-sm text-muted">Memuat pilihan…</p>}
        <div className="flex flex-col gap-2">
          {options?.map((o) => (
            <button
              key={o.key}
              disabled={pending}
              onClick={async () => {
                const ok = await call(`/api/workouts/${workoutId}/swap`, { json: { key: o.key } });
                if (ok) onClose();
              }}
              className="rounded-2xl border border-line p-3.5 text-left hover:bg-bg"
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

function WeekStrip({ week, today }: { week: Workout[]; today: string }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label="Minggu ini">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-muted">Minggu ini</h2>
        <Link href="/plan" className="text-[13px] font-medium text-accent">
          Lihat rencana
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, d) => {
          const w = week.find((x) => dayOfWeek(x.date) === d);
          const isToday = w?.date === today;
          const moved = !!w?.originalType || !!w?.originalDate;
          const label = !w || w.type === "REST" || w.type === "MOBILITY" ? "—" : formatKm(w.distanceKm);
          return (
            <div
              key={d}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 ${isToday ? "border-[1.5px] border-ink bg-surface" : "border-[1.5px] border-transparent bg-chip"}`}
              title={w ? workoutTitle(w) : undefined}
            >
              <span className="text-[11px] text-muted">{DAY_SHORT[d]}</span>
              <span className={`text-[13px] font-semibold ${w?.status === "SKIPPED" || w?.status === "DROPPED" ? "text-muted line-through" : ""}`}>{label}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${w?.status === "DONE" ? "bg-ok" : moved ? "bg-accent" : w && isRun(w.type) ? "bg-[#b8b5ad]" : "bg-transparent"}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
