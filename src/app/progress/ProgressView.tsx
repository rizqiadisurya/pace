"use client";
import Link from "next/link";
import { useState } from "react";
import { DAY_LONG, dayOfWeek, formatKm, formatPace } from "@/lib/engine";
import { formatDuration, type Dashboard, type DashboardStatus } from "@/lib/store";
import { Card } from "@/components/ui";
import { IconCheck, IconPlus, IconRefresh } from "@/components/icons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const shortDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const longDate = (d: string) => `${DAY_LONG[dayOfWeek(d)]}, ${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

export function ProgressView({ d }: { d: Dashboard }) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-12">
      <header className="flex items-end justify-between">
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Progres</h1>
        <Link
          href="/checkin"
          className="-mb-1 inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold"
        >
          <IconPlus size={18} /> Catat lari
        </Link>
      </header>
      <EventHero d={d} />
      <StatusCard d={d} />
      <VolumeChart d={d} />
      <PhaseTimeline d={d} />
      {d.goal.raceKm ? <PredictionCard d={d} /> : null}
      <StatGrid d={d} />
      <ReadinessTrend d={d} />
      <RecentRuns d={d} />
    </main>
  );
}

// ---------- Hero: event & hitung mundur ----------

function EventHero({ d }: { d: Dashboard }) {
  const { goal, plan } = d;
  const progress = plan.totalWeeks ? Math.min(1, plan.week / plan.totalWeeks) : 0;
  const race = goal.daysLeft !== null && goal.raceDate;
  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-ink p-5 text-white" aria-label="Target event">
      <span className="text-xs font-semibold uppercase tracking-wider text-accent-light">{race ? "Target event" : "Target"}</span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight">{goal.eventName || goal.label}</h2>
        {race && (
          <p className="text-sm text-[#d4d6da]">
            {goal.eventName ? `${goal.label} · ` : ""}
            {longDate(goal.raceDate!)}
          </p>
        )}
      </div>

      {race ? (
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[56px] font-bold leading-none tabular-nums tracking-tight">
            {goal.daysLeft! > 0 ? goal.daysLeft : goal.daysLeft === 0 ? "Hari H" : "Selesai"}
          </span>
          {goal.daysLeft! > 0 && <span className="text-[15px] text-[#d4d6da]">hari lagi</span>}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-[#d4d6da]">Bangun kebiasaan lari yang konsisten tanpa cedera.</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <HeroTile label="Minggu" value={`${plan.week} / ${plan.totalWeeks}`} />
        <HeroTile label="Fase" value={plan.phaseLabel ?? "—"} />
        <HeroTile label={goal.targetTimeSec ? "Target finish" : "Jarak"} value={goal.targetTimeSec ? formatDuration(goal.targetTimeSec) : goal.raceKm ? `${formatKm(Math.round(goal.raceKm * 10) / 10)} km` : "—"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-dark-2" role="progressbar" aria-valuemin={0} aria-valuemax={plan.totalWeeks} aria-valuenow={plan.week} aria-label="Progres rencana">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-[12px] text-dark-muted">{Math.round(progress * 100)}% rencana latihan berjalan</span>
      </div>
    </section>
  );
}

function HeroTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-dark-2 p-2.5">
      <span className="text-[11px] text-dark-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ---------- Status kesiapan ----------

const STATUS: Record<DashboardStatus, { label: string; tone: string; text: (d: Dashboard) => string }> = {
  EARLY: {
    label: "Baru mulai",
    tone: "bg-chip text-ink",
    text: () => "Jalani beberapa sesi dulu. Setelah ada 3 sesi terjadwal, Pace bisa menilai apakah kamu on track.",
  },
  ON_TRACK: {
    label: "On track",
    tone: "bg-ok-soft text-ok-ink",
    text: (d) => `${d.adherence.done} dari ${d.adherence.planned} sesi selesai dalam 4 minggu terakhir. Pertahankan ritme ini.`,
  },
  INCONSISTENT: {
    label: "Perlu lebih konsisten",
    tone: "bg-accent-soft text-accent-ink",
    text: (d) =>
      `${d.adherence.done} dari ${d.adherence.planned} sesi selesai dalam 4 minggu terakhir. Kalau jadwal sering bentrok, coba kurangi hari lari di Profil daripada sering melewatkan sesi.`,
  },
  BEHIND: {
    label: "Tertinggal dari rencana",
    tone: "bg-accent-soft text-accent-ink",
    text: (d) =>
      `Baru ${d.adherence.done} dari ${d.adherence.planned} sesi selesai dalam 4 minggu terakhir. Jangan mengejar sesi yang terlewat; ikuti saja sesi hari ini.`,
  },
};

function StatusCard({ d }: { d: Dashboard }) {
  const st = STATUS[d.status];
  const good = d.status === "ON_TRACK";
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold ${st.tone}`}>
          {good ? <IconCheck size={16} /> : <IconRefresh size={16} />}
          {st.label}
        </span>
        {d.adherence.pct !== null && d.status !== "EARLY" && (
          <span className="font-display text-[22px] font-semibold tabular-nums">{d.adherence.pct}%</span>
        )}
      </div>
      <p className="text-[14px] leading-relaxed text-muted">{st.text(d)}</p>
    </Card>
  );
}

// ---------- Volume mingguan: bullet chart (rencana = lintasan, selesai = isian) ----------

function niceMax(v: number) {
  const steps = [10, 20, 30, 40, 50, 60, 80, 100];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 20) * 20;
}

function VolumeChart({ d }: { d: Dashboard }) {
  const weeks = d.weeks;
  const currentIdx = Math.max(0, weeks.findIndex((w) => w.isCurrent));
  const [sel, setSel] = useState<number>(currentIdx);
  const W = 350;
  const H = 150;
  const padL = 24;
  const padB = 20;
  const padT = 8;
  const max = niceMax(Math.max(10, ...weeks.map((w) => Math.max(w.plannedKm, w.doneKm))));
  const slot = (W - padL) / Math.max(1, weeks.length);
  const barW = Math.min(14, slot - 4);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const s = weeks[sel];

  // Batang dengan ujung atas membulat 4px, dasar persegi
  const bar = (x: number, w: number, top: number, bottom: number, r = 4) => {
    const h = bottom - top;
    if (h <= 0) return "";
    const rr = Math.min(r, h, w / 2);
    return `M${x},${bottom} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${bottom} Z`;
  };
  const inner = Math.max(4, barW - 6); // isian "dijalani" lebih ramping di dalam lintasan rencana

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Volume mingguan</h2>
          <p className="text-[12px] text-muted">km dijalani dibanding rencana</p>
        </div>
        <div className="flex gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#e8e5df]" /> Rencana
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Dijalani
          </span>
        </div>
      </div>

      <p className="min-h-5 text-[13px]" aria-live="polite">
        {s && (
          <>
            <span className="font-semibold">Minggu {s.week}</span>
            <span className="text-muted">
              {" "}
              · mulai {shortDate(s.startDate)} ·{" "}
            </span>
            <span className="font-semibold tabular-nums">{formatKm(s.doneKm)}</span>
            <span className="text-muted"> / {formatKm(s.plannedKm)} km</span>
            {s.isCurrent && <span className="text-muted"> (minggu ini)</span>}
          </>
        )}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik volume mingguan: km dijalani dibanding rencana per minggu">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#efede7" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#6b6f76">
              {t}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const base = y(0);
          const active = i === sel;
          return (
            <g key={w.week} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
              {/* hit target lebih besar dari batang */}
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT} fill="transparent" />
              <path d={bar(x, barW, y(w.plannedKm), base)} fill={w.isFuture ? "#f0eee9" : "#e8e5df"} />
              {w.doneKm > 0 && <path d={bar(x + (barW - inner) / 2, inner, y(Math.min(w.doneKm, max)), base, 3)} fill="#c2410c" />}
              {active && <rect x={x - 2} y={base + 4} width={barW + 4} height={3} rx={1.5} fill="#15171a" />}
              {(i === 0 || (i + 1) % 4 === 0 || w.isCurrent) && (
                <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="10" fill={w.isCurrent ? "#15171a" : "#6b6f76"} fontWeight={w.isCurrent ? 700 : 400}>
                  {w.week}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-muted">Ketuk batang untuk detail. Angka di bawah = minggu ke-.</p>

      <table className="sr-only">
        <caption>Volume mingguan</caption>
        <thead>
          <tr>
            <th>Minggu</th>
            <th>Rencana (km)</th>
            <th>Dijalani (km)</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week}>
              <td>{w.week}</td>
              <td>{w.plannedKm}</td>
              <td>{w.doneKm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------- Fase latihan ----------

const PHASE_SHADE: Record<string, string> = {
  COMEBACK: "#e8e5df",
  BASE: "#d6d3cc",
  BUILD: "#a3a6ad",
  PEAK: "#5b5f66",
  TAPER: "#b8b5ad",
};
const PHASE_TEXT: Record<string, string> = { COMEBACK: "#15171a", BASE: "#15171a", BUILD: "#15171a", PEAK: "#ffffff", TAPER: "#15171a" };
const PHASE_HINT: Record<string, string> = {
  COMEBACK: "Membangun ulang kebiasaan dan ketahanan kaki. Semua lari santai.",
  BASE: "Membangun fondasi aerobik. Sebagian besar lari santai, plus strides.",
  BUILD: "Mulai ada tempo run. Volume naik bertahap.",
  PEAK: "Minggu terberat: tempo dan interval. Tidur dan makan jadi kunci.",
  TAPER: "Volume turun supaya segar di hari race. Jangan menambah sesi.",
};

function PhaseTimeline({ d }: { d: Dashboard }) {
  const total = d.plan.totalWeeks || 1;
  const pos = ((d.plan.week - 0.5) / total) * 100;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Fase latihan</h2>
        <p className="text-[12px] text-muted">{d.plan.phase ? PHASE_HINT[d.plan.phase] : ""}</p>
      </div>
      <div className="relative pt-5">
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold"
          style={{ left: `clamp(28px, ${pos}%, calc(100% - 28px))` }}
        >
          Kamu di sini
        </span>
        <span className="absolute top-[15px] h-[34px] w-0.5 -translate-x-1/2 rounded bg-accent" style={{ left: `${pos}%` }} aria-hidden="true" />
        <div className="flex h-7 gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={`Fase: ${d.plan.phases.map((p) => `${p.label} minggu ${p.startWeek}–${p.endWeek}`).join(", ")}`}>
          {d.plan.phases.map((p) => {
            const span = p.endWeek - p.startWeek + 1;
            return (
              <div
                key={p.phase + p.startWeek}
                className="flex items-center justify-center text-[11px] font-semibold"
                style={{ flexGrow: span, flexBasis: 0, background: PHASE_SHADE[p.phase], color: PHASE_TEXT[p.phase] }}
              >
                {span / total > 0.12 ? p.label : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-0.5 text-[10px] text-muted">
          {d.plan.phases.map((p) => (
            <span key={p.phase + p.startWeek} className="text-center" style={{ flexGrow: p.endWeek - p.startWeek + 1, flexBasis: 0 }}>
              {p.startWeek === p.endWeek ? `M${p.startWeek}` : `M${p.startWeek}–${p.endWeek}`}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------- Prediksi finish ----------

function PredictionCard({ d }: { d: Dashboard }) {
  const p = d.prediction;
  const target = d.goal.targetTimeSec;
  if (!p)
    return (
      <Card className="flex flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold">Prediksi waktu finish</h2>
        <p className="text-[14px] leading-relaxed text-muted">Catat lari minimal 3 km dengan durasinya. Pace akan memperkirakan waktu finish {d.goal.label.toLowerCase()}-mu.</p>
      </Card>
    );
  const diff = target ? p.timeSec - target : null;
  const pace = d.goal.raceKm ? p.timeSec / d.goal.raceKm : null;
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold">Prediksi waktu finish</h2>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[36px] font-semibold leading-none tabular-nums tracking-tight">{formatDuration(p.timeSec)}</span>
        {pace && <span className="text-[13px] text-muted">≈ {formatPace(pace)}/km</span>}
      </div>
      {diff !== null && (
        <p className={`text-[14px] font-medium ${diff <= 0 ? "text-ok" : "text-accent-ink"}`}>
          {diff <= 0
            ? `Lebih cepat ${formatDuration(-diff)} dari target ${formatDuration(target!)}`
            : `${formatDuration(diff)} lebih lambat dari target ${formatDuration(target!)}`}
        </p>
      )}
      <p className="text-[12px] leading-relaxed text-muted">
        Dari lari {formatKm(p.basedOn.distanceKm)} km pada {shortDate(p.basedOn.date)} ({formatDuration(p.basedOn.durationSec)}), rumus Riegel. Hanya perkiraan:
        lari santai membuat prediksi terlihat lebih lambat dari kemampuanmu.
      </p>
    </Card>
  );
}

// ---------- Angka ringkas ----------

function StatGrid({ d }: { d: Dashboard }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Long run terjauh" value={`${formatKm(d.longRun.longestRecentKm)} km`} sub={d.longRun.peakLongKm ? `puncak rencana ${formatKm(d.longRun.peakLongKm)} km` : "6 minggu terakhir"} />
      <Stat label="Konsisten" value={`${d.streakWeeks} mgg`} sub="berturut-turut ada lari" />
      <Stat label="Total" value={`${formatKm(d.totals.km)} km`} sub={`${d.totals.runs} lari tercatat`} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[16px] border border-line-soft bg-surface p-3">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-display text-[20px] font-semibold tabular-nums leading-tight">{value}</span>
      <span className="text-[11px] leading-snug text-muted">{sub}</span>
    </div>
  );
}

// ---------- Tren readiness ----------

function ReadinessTrend({ d }: { d: Dashboard }) {
  const pts = d.readinessTrend;
  const has = pts.filter((p) => p.score !== null);
  const W = 350;
  const H = 96;
  const padL = 24;
  const padT = 8;
  const padB = 18;
  const x = (i: number) => padL + ((W - padL - 8) * i) / (pts.length - 1);
  const LO = 30; // skor di bawah 30 jarang; domain 30–100 supaya variasi terlihat
  const y = (v: number) => padT + (H - padT - padB) * (1 - (Math.max(LO, v) - LO) / (100 - LO));
  // Garis putus di hari tanpa check-in
  const segs: string[] = [];
  let cur = "";
  pts.forEach((p, i) => {
    if (p.score === null) {
      if (cur) segs.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${x(i)},${y(p.score)} `;
  });
  if (cur) segs.push(cur);
  const last = [...pts].reverse().find((p) => p.score !== null);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Readiness 14 hari</h2>
          <p className="text-[12px] text-muted">dari check-in pagi</p>
        </div>
        {last && <span className="font-display text-[22px] font-semibold tabular-nums">{last.score}</span>}
      </div>
      {has.length < 2 ? (
        <p className="text-[14px] leading-relaxed text-muted">Isi jam tidur di halaman Hari ini selama beberapa hari untuk melihat trennya.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Tren readiness 14 hari, terakhir ${last?.score}`}>
          {[50, 70].map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#efede7" strokeWidth="1" />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#6b6f76">
                {t}
              </text>
            </g>
          ))}
          {segs.map((sg, i) => (
            <path key={i} d={sg} fill="none" stroke="#15171a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {pts.map((p, i) =>
            p.score === null ? null : (
              <circle key={i} cx={x(i)} cy={y(p.score)} r={4} fill={p.score >= 70 ? "#047857" : "#c2410c"} stroke="#ffffff" strokeWidth="2">
                <title>
                  {shortDate(p.date)}: {p.score}
                </title>
              </circle>
            ),
          )}
          <text x={padL} y={H - 3} fontSize="10" fill="#6b6f76">
            {shortDate(pts[0].date)}
          </text>
          <text x={W - 8} y={H - 3} fontSize="10" fill="#6b6f76" textAnchor="end">
            Hari ini
          </text>
        </svg>
      )}
    </Card>
  );
}

// ---------- Riwayat ----------

const PAIN: Record<string, string> = { KNEE: "Lutut", SHIN_CALF: "Betis", OTHER: "Nyeri" };

function RecentRuns({ d }: { d: Dashboard }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Lari terakhir">
      <h2 className="text-[13px] font-semibold text-muted">Lari terakhir</h2>
      {d.recent.length === 0 ? (
        <Card>
          <p className="text-[14px] text-muted">Belum ada lari tercatat. Setelah lari, tekan "Selesai lari" di halaman Hari ini.</p>
        </Card>
      ) : (
        <ul className="rounded-[20px] border border-line-soft bg-surface px-4 py-1">
          {d.recent.map((a, i) => (
            <li key={a.id} className={`flex items-center gap-3 py-3 ${i < d.recent.length - 1 ? "border-b border-[#f0eee9]" : ""}`}>
              <span className="w-14 text-[12px] text-muted">{shortDate(a.date)}</span>
              <span className="flex-1 text-[15px] font-semibold tabular-nums">{formatKm(a.distanceKm)} km</span>
              <span className="text-[13px] tabular-nums text-muted">{formatPace(a.durationSec / a.distanceKm)}/km</span>
              {a.pain ? (
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink">{PAIN[a.pain]}</span>
              ) : a.rpe ? (
                <span className="w-12 text-right text-[12px] text-muted">RPE {a.rpe}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
