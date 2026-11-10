"use client";
import { formatPace } from "@/lib/engine";

/**
 * Stepper pace mm:ss per km. Menghindari ketik ":" (keyboard angka iOS tidak punya titik dua).
 */
export function PaceStepper({
  value,
  onChange,
  label,
  min = 180,
  max = 900,
  step = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const btn =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-xl font-semibold text-ink active:bg-chip disabled:opacity-40";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={`${label}: lebih cepat 5 detik`} disabled={value <= min} onClick={() => set(value - step)}>
        −
      </button>
      <output className="flex-1 text-center" aria-live="polite">
        <span className="font-display text-[32px] font-semibold tabular-nums tracking-tight">{formatPace(value)}</span>
        <span className="ml-1 text-sm text-muted">/km</span>
      </output>
      <button type="button" className={btn} aria-label={`${label}: lebih lambat 5 detik`} disabled={value >= max} onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
}

/** Durasi dalam dua kolom angka (menit, detik). */
export function DurationInput({
  minutes,
  seconds,
  onChange,
}: {
  minutes: string;
  seconds: string;
  onChange: (m: string, s: string) => void;
}) {
  const field = "h-12 w-full rounded-xl border border-line bg-surface px-3 text-center text-lg font-semibold tabular-nums text-ink";
  const digits = (v: string, maxLen: number) => v.replace(/\D/g, "").slice(0, maxLen);
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted">
        Menit
        <input inputMode="numeric" pattern="[0-9]*" className={field} value={minutes} onChange={(e) => onChange(digits(e.target.value, 3), seconds)} placeholder="0" />
      </label>
      <span className="pb-3 text-lg font-semibold text-muted">:</span>
      <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted">
        Detik
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          className={field}
          value={seconds}
          onChange={(e) => onChange(minutes, digits(e.target.value, 2))}
          onBlur={() => seconds && Number(seconds) > 59 && onChange(minutes, "59")}
          placeholder="00"
        />
      </label>
    </div>
  );
}
