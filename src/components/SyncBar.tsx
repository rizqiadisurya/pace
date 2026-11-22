"use client";
import Link from "next/link";
import { useSync } from "@/lib/usePace";
import { describeSummary } from "@/lib/sync";
import { IconRefresh } from "./icons";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`;
}

/** Status sinkron Garmin/Strava. autoMinutes > 0 → sinkron otomatis bila data lebih tua. */
export function SyncBar({ autoMinutes = 0 }: { autoMinutes?: number }) {
  const { config, ready, busy, error, run } = useSync(autoMinutes);
  if (!config) return null;
  if (!ready)
    return (
      <Link href="/profile/#sinkron" className="flex min-h-11 items-center gap-2 rounded-[14px] border border-dashed border-line px-3.5 py-2.5 text-[13px] text-muted">
        <IconRefresh size={16} /> Sambungkan Garmin & Strava supaya lari dan tidurmu masuk otomatis
      </Link>
    );
  const sources = [config.garminEnabled && "Garmin", config.stravaEnabled && config.stravaRefresh && "Strava"].filter(Boolean).join(" + ");
  const err = error ?? config.lastError;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-2 text-[13px]" role="status" aria-live="polite">
        <div className="min-w-0 flex-1">
          <span className="font-semibold">{sources}</span>
          <span className="text-muted">
            {" · "}
            {busy ? "menyinkronkan…" : config.lastSyncAt ? `disinkron ${ago(config.lastSyncAt)}` : "belum pernah sinkron"}
          </span>
          {!busy && config.lastSummary && <span className="block truncate text-[12px] text-muted">{describeSummary(config.lastSummary)}</span>}
        </div>
        <button
          onClick={() => void run()}
          disabled={busy}
          className="-mr-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-semibold text-ink disabled:opacity-50"
          aria-label="Sinkron sekarang"
        >
          <IconRefresh size={16} className={busy ? "animate-spin" : ""} /> Sinkron
        </button>
      </div>
      {err && !busy && <p className="px-1 text-[12px] text-accent-ink">{err}</p>}
    </div>
  );
}
