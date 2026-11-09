import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { previewSkip } from "@/lib/coach";
import { DAY_SHORT, dayOfWeek, workoutTitle, type Workout } from "@/lib/engine";
import { getCurrentUser, HttpError } from "@/lib/session";
import { IconBack, IconShield } from "@/components/icons";
import { Chip } from "@/components/ui";
import { ConfirmSkip } from "./ConfirmSkip";

export const dynamic = "force-dynamic";

function tagFor(before: Workout | undefined, after: Workout): string | null {
  if (!before) return null;
  if (after.status === "SKIPPED") return "Skip";
  if (before.type !== after.type || before.distanceKm !== after.distanceKm) return before.type === "REST" ? "Baru" : "Pindah";
  return null;
}

export default async function SkipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  const { id } = await params;
  let preview;
  try {
    preview = await previewSkip(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { before, week, notes } = preview;
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-3 px-5 pt-12">
        <Link href="/today" aria-label="Kembali" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface">
          <IconBack />
        </Link>
        <span className="text-[15px] font-semibold">Skip hari ini</span>
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
      <ConfirmSkip id={id} />
    </main>
  );
}
