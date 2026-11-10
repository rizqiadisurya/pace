"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { checkIn } from "@/lib/store";
import { DurationInput } from "@/components/inputs";
import { useRun } from "@/lib/usePace";

const RPE_LABEL: Record<number, string> = {
  1: "Santai sekali", 2: "Sangat ringan", 3: "Ringan", 4: "Ringan, masih bisa ngobrol", 5: "Sedang",
  6: "Agak berat", 7: "Berat", 8: "Sangat berat", 9: "Hampir maksimal", 10: "Habis-habisan",
};
const PAIN = [
  { v: null, l: "Tidak ada" },
  { v: "KNEE", l: "Lutut" },
  { v: "SHIN_CALF", l: "Betis / tulang kering" },
  { v: "OTHER", l: "Lainnya" },
] as const;

export function CheckInForm({ workoutId, plannedKm, sessionTitle }: { workoutId: string | null; plannedKm: number | null; sessionTitle: string | null }) {
  const { run, error } = useRun();
  const [km, setKm] = useState(plannedKm ? String(plannedKm) : "");
  const [mm, setMm] = useState("");
  const [ss, setSs] = useState("");
  const [hr, setHr] = useState("");
  const [rpe, setRpe] = useState(4);
  const [pain, setPain] = useState<(typeof PAIN)[number]["v"]>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const durationSec = (Number(mm) || 0) * 60 + Math.min(59, Number(ss) || 0);

  if (feedback)
    return (
      <main className="flex flex-1 flex-col gap-5 px-5 pt-12">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ok">
          <IconCheck size={18} /> Lari tercatat
        </div>
        <h1 className="font-display text-[40px] font-bold leading-none tracking-tight">{km.replace(".", ",")} km</h1>
        <div className="rounded-2xl bg-ink p-4 text-sm leading-relaxed text-[#e4e5e8]">{feedback}</div>
        <Link href="/today" className="inline-flex h-12 items-center justify-center rounded-[14px] bg-accent font-semibold text-white">
          Kembali ke hari ini
        </Link>
      </main>
    );

  const valid = Number(km) > 0 && durationSec > 0;
  const field = "h-12 w-full rounded-xl border border-line bg-surface px-3 text-lg font-semibold tabular-nums text-ink placeholder:font-normal placeholder:text-[#a3a6ad]";
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Catat lari</h1>
        <p className="text-[13px] text-muted">{sessionTitle ? `Sesi hari ini: ${sessionTitle}` : "Lari di luar rencana"}</p>
      </div>
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
          Jarak (km)
          <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value.replace(",", "."))} className={field} placeholder="Jarak" />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Durasi</span>
          <DurationInput minutes={mm} seconds={ss} onChange={(m, s) => (setMm(m), setSs(s))} />
        </div>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
          Rata-rata detak jantung (opsional)
          <input inputMode="numeric" pattern="[0-9]*" value={hr} onChange={(e) => setHr(e.target.value.replace(/\D/g, ""))} className={field} placeholder="bpm, dari jam tangan" />
        </label>
      </Card>
      <Card className="flex flex-col gap-3.5">
        <div>
          <h2 className="text-[17px] font-semibold">Seberat apa rasanya?</h2>
          <p className="text-[13px] text-muted">1 = santai sekali · 10 = habis-habisan</p>
        </div>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="RPE">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rpe === n}
              aria-label={`RPE ${n}`}
              onClick={() => setRpe(n)}
              className={`h-11 rounded-xl text-[15px] font-semibold ${rpe === n ? "bg-accent text-white" : "border border-line bg-bg"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[13px] font-medium">RPE {rpe} · {RPE_LABEL[rpe]}</span>
      </Card>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[15px] font-semibold">Ada yang nyeri?</legend>
        <div className="flex flex-wrap gap-2">
          {PAIN.map((p) => (
            <button
              key={p.l}
              aria-pressed={pain === p.v}
              onClick={() => setPain(p.v)}
              className={`h-10 rounded-full px-4 text-sm ${pain === p.v ? "bg-ink font-semibold text-white" : "border border-line bg-surface font-medium"}`}
            >
              {p.l}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-[13px] text-accent-ink">{error}</p>}
      <Button
        className="mt-auto"
        disabled={!valid}
        onClick={() => {
          const res = run(() =>
            checkIn({ workoutId, distanceKm: Number(km), durationSec, avgHr: hr ? Number(hr) : null, rpe, pain }),
          );
          if (res) setFeedback(res.feedback);
        }}
      >
        Simpan
      </Button>
    </main>
  );
}
