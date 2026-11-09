"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { DAY_LONG, DAY_SHORT } from "@/lib/engine/dates";

type Goal = "10K" | "HM" | "FM" | "RETURN";
const GOALS: { id: Goal; title: string; desc: string }[] = [
  { id: "10K", title: "10K", desc: "Race 10 km" },
  { id: "HM", title: "Half marathon", desc: "Race 21,1 km" },
  { id: "FM", title: "Marathon", desc: "Race 42,2 km" },
  { id: "RETURN", title: "Kembali rutin lari", desc: "Tanpa target race" },
];
const MODES = [
  { id: "AUTO", title: "Auto", desc: "Pace langsung menyesuaikan, kamu diberi tahu tiap pagi." },
  { id: "ASK", title: "Tanya dulu (disarankan)", desc: "Pace mengusulkan, kamu yang konfirmasi. Bisa diubah kapan saja." },
  { id: "SUGGEST", title: "Saran saja", desc: "Rencana tidak pernah berubah otomatis." },
] as const;

const input = "h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink";
const label = "flex flex-col gap-1.5 text-[13px] font-medium text-muted";

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [f, setF] = useState({
    name: "",
    goalType: "HM" as Goal,
    raceDate: "",
    targetPace: "",
    easyPace: "7:00",
    baseWeeklyKm: "15",
    weeksOff: "0",
    availableDays: [0, 2, 3, 5, 6],
    longRunDay: 6,
    autonomy: "ASK" as (typeof MODES)[number]["id"],
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleDay = (d: number) =>
    set("availableDays", f.availableDays.includes(d) ? f.availableDays.filter((x) => x !== d) : [...f.availableDays, d].sort());

  const steps = ["Target", "Kondisi", "Jadwal", "Otonomi"];
  const canNext = [
    f.name.trim() && (f.goalType === "RETURN" || f.raceDate),
    /^\d{1,2}:\d{2}$/.test(f.easyPace) && f.baseWeeklyKm !== "",
    f.availableDays.length >= 2 && f.availableDays.includes(f.longRunDay),
    true,
  ][step];

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name,
        goalType: f.goalType,
        raceDate: f.goalType === "RETURN" ? null : f.raceDate,
        targetPace: f.targetPace || null,
        easyPace: f.easyPace,
        baseWeeklyKm: Number(f.baseWeeklyKm),
        weeksOff: Number(f.weeksOff),
        availableDays: f.availableDays,
        longRunDay: f.longRunDay,
        autonomy: f.autonomy,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) return setError(data.error ?? "Gagal membuat rencana.");
    router.push("/today");
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex flex-col gap-2.5 px-5 pt-12">
        <div className="flex gap-1.5" role="img" aria-label={`Langkah ${step + 1} dari ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-[#dad7d0]"}`} />
          ))}
        </div>
        <span className="text-xs font-medium text-muted">
          Langkah {step + 1} dari {steps.length} · {steps[step]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {step === 0 && (
          <>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Kamu lari untuk apa?</h1>
            <label className={label}>
              Nama panggilan
              <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Rizqi" />
            </label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Target">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  role="radio"
                  aria-checked={f.goalType === g.id}
                  onClick={() => set("goalType", g.id)}
                  className={`rounded-[14px] bg-surface p-3.5 text-left ${f.goalType === g.id ? "border-[1.5px] border-ink" : "border border-line"}`}
                >
                  <span className="block text-[15px] font-semibold">{g.title}</span>
                  <span className="block text-[13px] text-muted">{g.desc}</span>
                </button>
              ))}
            </div>
            {f.goalType !== "RETURN" && (
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Tanggal race
                  <input type="date" className={input} value={f.raceDate} onChange={(e) => set("raceDate", e.target.value)} />
                </label>
                <label className={label}>
                  Target pace (ops.)
                  <input className={input} value={f.targetPace} onChange={(e) => set("targetPace", e.target.value)} placeholder="6:00" inputMode="numeric" />
                </label>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Kondisimu sekarang</h1>
            <label className={label}>
              Pace santai yang nyaman (mm:ss per km)
              <input className={input} value={f.easyPace} onChange={(e) => set("easyPace", e.target.value)} inputMode="numeric" />
            </label>
            <label className={label}>
              Rata-rata km per minggu, 4 minggu terakhir
              <input className={input} value={f.baseWeeklyKm} onChange={(e) => set("baseWeeklyKm", e.target.value)} inputMode="decimal" />
            </label>
            <label className={label}>
              Sudah berapa minggu tidak lari? (0 jika masih rutin)
              <input className={input} value={f.weeksOff} onChange={(e) => set("weeksOff", e.target.value)} inputMode="numeric" />
            </label>
            {Number(f.weeksOff) >= 4 && (
              <p className="rounded-[14px] bg-ok-soft p-3.5 text-[13px] leading-relaxed text-ok-ink">
                Selamat datang kembali. Comeback mode aktif: {Number(f.weeksOff) >= 12 ? "3" : "2"} minggu pertama hanya easy run dan strides, volume
                mulai dari setengahnya.
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Hari apa saja kamu bisa lari?</h1>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_SHORT.map((d, i) => (
                <button
                  key={d}
                  aria-pressed={f.availableDays.includes(i)}
                  onClick={() => toggleDay(i)}
                  className={`h-12 rounded-xl text-[13px] font-semibold ${f.availableDays.includes(i) ? "bg-ink text-white" : "border border-line bg-surface"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className={label}>
              Hari long run
              <select className={input} value={f.longRunDay} onChange={(e) => set("longRunDay", Number(e.target.value))}>
                {f.availableDays.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LONG[d]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {step === 3 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-3 font-display text-[28px] font-semibold leading-tight tracking-tight">Seberapa bebas Pace mengubah rencanamu?</legend>
            {MODES.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-[14px] bg-surface p-3.5 ${f.autonomy === m.id ? "border-[1.5px] border-ink" : "border border-line"}`}>
                <input type="radio" name="autonomy" checked={f.autonomy === m.id} onChange={() => set("autonomy", m.id)} className="mt-0.5 h-5 w-5 accent-ink" />
                <span>
                  <span className="block text-[15px] font-semibold">{m.title}</span>
                  <span className="block text-[13px] leading-snug text-muted">{m.desc}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {error && <p className="text-[13px] text-accent-ink">{error}</p>}
      </div>

      <div className="flex gap-2 px-5 pb-9">
        {step > 0 && (
          <Button variant="ghost" className="flex-1" onClick={() => setStep(step - 1)}>
            Kembali
          </Button>
        )}
        <Button className="flex-[2]" disabled={!canNext || pending} onClick={() => (step < steps.length - 1 ? setStep(step + 1) : submit())}>
          {step < steps.length - 1 ? "Lanjut" : pending ? "Menyusun rencana…" : "Buat rencanaku"}
        </Button>
      </div>
    </main>
  );
}
