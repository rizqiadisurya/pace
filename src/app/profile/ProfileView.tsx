"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { exportData, resetAll, updateProfile, type Profile } from "@/lib/store";
import { useRun } from "@/lib/usePace";

const MODES = [
  { id: "AUTO", title: "Auto", desc: "Pace langsung menyesuaikan, kamu diberi tahu tiap pagi." },
  { id: "ASK", title: "Tanya dulu", desc: "Pace mengusulkan, kamu yang konfirmasi." },
  { id: "SUGGEST", title: "Saran saja", desc: "Rencana tidak pernah berubah otomatis." },
] as const;

export function ProfileView({ profile, runs }: { profile: Profile; runs: number }) {
  const router = useRouter();
  const { run, error } = useRun();
  const [msg, setMsg] = useState<string | null>(null);

  function download() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pace-${profile.name.toLowerCase().replace(/\W+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
      <h1 className="font-display text-[28px] font-semibold tracking-tight">{profile.name}</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-semibold">Seberapa bebas Pace mengubah rencanamu?</legend>
        {MODES.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-start gap-3 rounded-[14px] bg-surface p-3.5 ${profile.autonomy === m.id ? "border-[1.5px] border-ink" : "border border-line"}`}
          >
            <input
              type="radio"
              name="autonomy"
              checked={profile.autonomy === m.id}
              onChange={() => run(() => updateProfile({ autonomy: m.id }))}
              className="mt-0.5 h-5 w-5 accent-ink"
            />
            <span>
              <span className="block text-[15px] font-semibold">{m.title}</span>
              <span className="block text-[13px] leading-snug text-muted">{m.desc}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Lokasi untuk cuaca & AQI</h2>
        <p className="text-[13px] text-muted">
          {Math.abs(profile.latitude + 6.2088) < 0.001 && Math.abs(profile.longitude - 106.8456) < 0.001
            ? "Saat ini: Jakarta (default). Pakai lokasimu agar saran jam lari lebih akurat."
            : "Saat ini: lokasimu. Saran cuaca dan AQI mengikuti lokasi ini."}
        </p>
        <Button
          variant="outline"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (pos) => {
                run(() => updateProfile({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                setMsg("Lokasi diperbarui.");
              },
              () => setMsg("Izin lokasi ditolak."),
            )
          }
        >
          Gunakan lokasiku
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Data kamu</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Semua data tersimpan hanya di perangkat ini ({runs} lari tercatat). Unduh untuk dikirim ke tim riset atau sebagai cadangan.
        </p>
        <Button variant="outline" onClick={download}>
          Unduh data (JSON)
        </Button>
      </Card>

      {(msg || error) && <p className="text-[13px] text-accent-ink">{error ?? msg}</p>}

      <Button
        variant="ghost"
        className="mt-auto text-accent-ink"
        onClick={() => {
          if (!confirm("Hapus profil, rencana, dan semua data lari di perangkat ini?")) return;
          resetAll();
          router.replace("/onboarding");
        }}
      >
        Hapus semua data
      </Button>
    </main>
  );
}
