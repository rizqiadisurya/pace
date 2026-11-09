"use client";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { useAction } from "@/components/useAction";

const MODES = [
  { id: "AUTO", title: "Auto", desc: "Pace langsung menyesuaikan, kamu diberi tahu tiap pagi." },
  { id: "ASK", title: "Tanya dulu", desc: "Pace mengusulkan, kamu yang konfirmasi." },
  { id: "SUGGEST", title: "Saran saja", desc: "Rencana tidak pernah berubah otomatis." },
] as const;

export function ProfileView(p: {
  name: string;
  autonomy: "AUTO" | "ASK" | "SUGGEST";
  stravaConnected: boolean;
  stravaAvailable: boolean;
  justConnected: boolean;
  location: { lat: number; lon: number };
}) {
  const { call, pending, error, router } = useAction();
  const [msg, setMsg] = useState<string | null>(p.justConnected ? "Strava terhubung." : null);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
      <h1 className="font-display text-[28px] font-semibold tracking-tight">{p.name}</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-semibold">Seberapa bebas Pace mengubah rencanamu?</legend>
        {MODES.map((m) => (
          <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-[14px] bg-surface p-3.5 ${p.autonomy === m.id ? "border-[1.5px] border-ink" : "border border-line"}`}>
            <input
              type="radio"
              name="autonomy"
              checked={p.autonomy === m.id}
              onChange={() => call("/api/me", { method: "PATCH", json: { autonomy: m.id } })}
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
        <h2 className="text-[15px] font-semibold">Strava</h2>
        {!p.stravaAvailable ? (
          <p className="text-[13px] text-muted">Belum dikonfigurasi. Isi STRAVA_CLIENT_ID dan STRAVA_CLIENT_SECRET di .env.</p>
        ) : p.stravaConnected ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={async () => {
              const r = await call<{ imported: number }>("/api/strava/sync", { method: "POST" });
              if (r) setMsg(`${r.imported} lari baru diimpor.`);
            }}
          >
            Sinkronkan aktivitas
          </Button>
        ) : (
          <a href="/api/strava/connect" className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#fc4c02] font-semibold text-white">
            Hubungkan Strava
          </a>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Lokasi untuk cuaca & AQI</h2>
        <p className="text-[13px] text-muted">
          {p.location.lat.toFixed(3)}, {p.location.lon.toFixed(3)}
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (pos) => call("/api/me", { method: "PATCH", json: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
              () => setMsg("Izin lokasi ditolak."),
            )
          }
        >
          Gunakan lokasiku
        </Button>
      </Card>

      {(msg || error) && <p className="text-[13px] text-accent-ink">{error ?? msg}</p>}

      <Button
        variant="ghost"
        className="mt-auto text-accent-ink"
        disabled={pending}
        onClick={async () => {
          if (!confirm("Hapus profil, rencana, dan semua data lari?")) return;
          if (await call("/api/me", { method: "DELETE" })) router.push("/onboarding");
        }}
      >
        Hapus semua data
      </Button>
    </main>
  );
}
