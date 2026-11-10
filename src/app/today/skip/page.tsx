"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { WithProfile, Splash } from "@/components/Guard";
import { IconBack, IconShield } from "@/components/icons";
import { Button, Chip } from "@/components/ui";
import { DAY_SHORT, dayOfWeek, workoutTitle, type Workout } from "@/lib/engine";
import { applySkip, previewSkip } from "@/lib/store";
import { useRun } from "@/lib/usePace";

function tagFor(before: Workout | undefined, after: Workout): string | null {
  if (!before) return null;
  if (after.status === "SKIPPED") return "Dilewati";
  if (before.type !== after.type || before.distanceKm !== after.distanceKm) return before.type === "REST" ? "Baru" : "Pindah";
  return null;
}

function SkipContent() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { run, error } = useRun();
  const preview = useMemo(() => {
    try {
      return previewSkip(id);
    } catch {
      return null;
    }
  }, [id]);
  if (!preview)
    return (
      <main className="flex min-h-dvh flex-col gap-4 p-5 pt-12">
        <p>Sesi tidak ditemukan.</p>
        <Link href="/today" className="text-accent underline">
          Kembali
        </Link>
      </main>
    );
  const { before, week, notes } = preview;
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-3 px-5 pt-12">
        <Link href="/today" aria-label="Kembali" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface">
          <IconBack />
        </Link>
        <span className="text-[15px] font-semibold">Lewati sesi hari ini</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">Istirahat dulu juga bagian dari latihan.</h1>
          <p className="text-sm leading-relaxed text-muted">{notes.slice(1).join(" ") || "Begini minggu ini setelah disusun ulang."}</p>
        </div>
        <ul className="rounded-[20px] border border-line-soft bg-surface px-4 py-1.5">
          {week.map((w, i) => {
            const b = before.find((x) => x.id === w.id);
            const tag = tagFor(b, w);
            return (
              <li key={w.id} className={`flex min-h-12 items-center gap-3 py-3 ${i < week.length - 1 ? "border-b border-[#f0eee9]" : ""}`}>
                <span className="w-9 text-[13px] font-semibold text-muted">{DAY_SHORT[dayOfWeek(w.date)]}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  {tag && b && <span className="text-xs text-muted line-through">{workoutTitle(b)}</span>}
                  <span className="text-sm font-semibold">{w.status === "SKIPPED" ? "Istirahat" : workoutTitle(w)}</span>
                </div>
                {tag && <Chip>{tag}</Chip>}
              </li>
            );
          })}
        </ul>
        <div className="flex items-start gap-2.5 rounded-[14px] bg-ok-soft px-3.5 py-3 text-[13px] leading-snug text-ok-ink">
          <IconShield size={18} className="mt-px shrink-0" />
          Sesi berat tetap berjarak minimal 48 jam. Volume minggu ini tidak bertambah.
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 pb-9">
        {error && <p className="text-[13px] text-accent-ink">{error}</p>}
        <Button
          onClick={() => {
            if (run(() => applySkip(id))) router.push("/today");
          }}
        >
          Terapkan perubahan
        </Button>
        <Link href="/today" className="inline-flex h-12 items-center justify-center rounded-[14px] text-[15px] font-medium hover:bg-chip">
          Batal, aku tetap lari
        </Link>
      </div>
    </main>
  );
}

export default function SkipPage() {
  return (
    <WithProfile>
      {() => (
        <Suspense fallback={<Splash />}>
          <SkipContent />
        </Suspense>
      )}
    </WithProfile>
  );
}
