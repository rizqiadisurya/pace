/**
 * Analisa "langkah berikutnya" setelah data masuk (manual atau sinkron Garmin/Strava).
 * Berbasis aturan dan transparan: setiap saran menyebut data yang memicunya.
 */
import { addDays, diffDays, formatDateId, weekStart, type ISODate } from "./dates";
import { formatKm, formatPace, workoutTitle, type PaceProfile, type Workout } from "./types";

export interface RunRecord {
  id: string;
  date: ISODate;
  distanceKm: number;
  durationSec: number;
  avgHr: number | null;
  rpe: number | null;
  pain: string | null;
  workoutId: string | null;
  source?: "MANUAL" | "GARMIN" | "STRAVA";
}

export interface SignalRecord {
  date: ISODate;
  sleepHours: number | null;
  hrvDeltaPct: number | null;
}

export type RunVerdict = "ON_TARGET" | "TOO_FAST" | "TOO_SLOW" | "TOO_HARD" | "SHORT" | "LONG" | "UNPLANNED";

export interface RunAnalysis {
  verdict: RunVerdict;
  headline: string;
  detail: string;
}

/** hrZones: batas atas Z1..Z5 (bpm). Z2 atas = hrZones[1]. */
export function analyzeRun(run: RunRecord, planned: Workout | null, paces: PaceProfile, hrZones: number[] | null): RunAnalysis {
  const pace = run.durationSec / run.distanceKm;
  const p = formatPace(pace);
  if (!planned || planned.type === "REST" || planned.type === "MOBILITY") {
    return {
      verdict: "UNPLANNED",
      headline: `Lari tambahan ${formatKm(run.distanceKm)} km`,
      detail: `Di luar rencana (${p}/km). Dihitung ke volume minggu ini; sesi berikutnya tetap seperti rencana.`,
    };
  }
  const ratio = run.distanceKm / Math.max(0.1, planned.distanceKm);
  const easyLike = planned.type === "EASY" || planned.type === "STRIDES" || planned.type === "LONG";
  const z2Top = hrZones?.[1] ?? null;

  if (easyLike) {
    const lo = planned.type === "LONG" ? paces.easyPaceSec + 15 : paces.easyPaceSec;
    if (z2Top && run.avgHr && run.avgHr > z2Top + 3)
      return {
        verdict: "TOO_HARD",
        headline: `${workoutTitle(planned)}: HR terlalu tinggi`,
        detail: `Rata-rata HR ${run.avgHr} bpm, di atas zona 2 (≤ ${z2Top}). Lari santai yang terlalu berat menumpuk lelah tanpa menambah fondasi aerobik. Pelankan pace sampai HR turun, jalan sebentar kalau perlu.`,
      };
    if (pace < lo - 15)
      return {
        verdict: "TOO_FAST",
        headline: `${workoutTitle(planned)}: terlalu cepat`,
        detail: `Pace ${p}/km, lebih cepat ${Math.round(lo - pace)} detik dari batas santai ${formatPace(lo)}/km. Simpan tenaga untuk sesi kualitas.`,
      };
  }
  if (planned.type === "TEMPO") {
    const diff = pace - paces.tempoPaceSec;
    // pace rata-rata termasuk pemanasan & pendinginan → toleransi lebih longgar
    if (diff < -25)
      return {
        verdict: "TOO_FAST",
        headline: "Tempo terlalu cepat",
        detail: `Rata-rata ${p}/km. Tempo seharusnya "nyaman tapi berat" di sekitar ${formatPace(paces.tempoPaceSec)}/km; terlalu cepat berubah jadi race dan butuh pemulihan lebih lama.`,
      };
    if (diff > 60)
      return {
        verdict: "TOO_SLOW",
        headline: "Tempo lebih pelan dari target",
        detail: `Rata-rata ${p}/km (target ±${formatPace(paces.tempoPaceSec)}/km di bagian inti). Kalau terasa berat, mungkin belum pulih; Pace akan memperhatikan readiness besok.`,
      };
  }
  if (ratio < 0.75)
    return {
      verdict: "SHORT",
      headline: `${workoutTitle(planned)}: lebih pendek`,
      detail: `${formatKm(run.distanceKm)} dari ${formatKm(planned.distanceKm)} km. Tidak apa-apa; jangan menambal jaraknya di sesi lain.`,
    };
  if (ratio > 1.25)
    return {
      verdict: "LONG",
      headline: `${workoutTitle(planned)}: lebih jauh dari rencana`,
      detail: `${formatKm(run.distanceKm)} km dari rencana ${formatKm(planned.distanceKm)} km. Kenaikan mendadak meningkatkan risiko cedera; sesi berikutnya tetap seperti rencana.`,
    };
  return {
    verdict: "ON_TARGET",
    headline: `${workoutTitle(planned)}: sesuai rencana`,
    detail: `${formatKm(run.distanceKm)} km di ${p}/km${run.avgHr ? `, HR ${run.avgHr}` : ""}. Mantap, eksekusinya pas.`,
  };
}

export type InsightTone = "good" | "warn" | "info";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  action?: { label: string; href: string };
}

export interface NextStepsInput {
  today: ISODate;
  workouts: Workout[];
  runs: RunRecord[];
  signals: SignalRecord[];
  paces: PaceProfile;
  hrZones: number[] | null;
}

const byDateDesc = (a: RunRecord, b: RunRecord) => b.date.localeCompare(a.date);

/** Kumpulan saran prioritas tertinggi dulu. */
export function nextSteps(input: NextStepsInput): Insight[] {
  const { today, workouts, paces, hrZones } = input;
  const runs = [...input.runs].sort(byDateDesc);
  const wById = new Map(workouts.map((w) => [w.id, w]));
  const out: Insight[] = [];

  // 1. Nyeri terakhir
  const lastRun = runs[0];
  if (lastRun?.pain && diffDays(today, lastRun.date) <= 3) {
    out.push({
      id: "pain",
      tone: "warn",
      title: "Pantau nyeri yang kamu laporkan",
      body: "Sesi berat ditahan sampai lari berikutnya terasa normal. Kalau nyeri bertambah atau tidak hilang dalam beberapa hari, periksakan ke dokter atau fisioterapis.",
    });
  }

  // 2. RPE belum diisi untuk lari hasil sinkron
  const noRpe = runs.find((r) => r.rpe == null && r.source && r.source !== "MANUAL" && diffDays(today, r.date) <= 3);
  if (noRpe) {
    out.push({
      id: `rpe-${noRpe.id}`,
      tone: "info",
      title: `Seberat apa lari ${formatDateId(noRpe.date).split(",")[0].toLowerCase()} kemarin?`,
      body: `${formatKm(noRpe.distanceKm)} km tercatat dari ${noRpe.source === "GARMIN" ? "Garmin" : "Strava"}. Isi RPE supaya Pace tahu seberapa lelah kamu.`,
      action: { label: "Isi RPE", href: `/today/#rpe` },
    });
  }

  // 3. Analisa lari terakhir (≤ 2 hari)
  if (lastRun && diffDays(today, lastRun.date) <= 2) {
    const a = analyzeRun(lastRun, lastRun.workoutId ? (wById.get(lastRun.workoutId) ?? null) : null, paces, hrZones);
    out.push({ id: `run-${lastRun.id}`, tone: a.verdict === "ON_TARGET" ? "good" : a.verdict === "UNPLANNED" ? "info" : "warn", title: a.headline, body: a.detail });
  }

  // 4. Tren easy run terlalu cepat/berat (≥ 2 dari 3 terakhir)
  const easyRuns = runs
    .filter((r) => r.workoutId && ["EASY", "STRIDES", "LONG"].includes(wById.get(r.workoutId)?.type ?? ""))
    .slice(0, 3);
  const hardEasy = easyRuns.filter((r) => {
    const v = analyzeRun(r, wById.get(r.workoutId!)!, paces, hrZones).verdict;
    return v === "TOO_FAST" || v === "TOO_HARD";
  });
  if (easyRuns.length >= 3 && hardEasy.length >= 2) {
    out.push({
      id: "easy-trend",
      tone: "warn",
      title: "Lari santaimu cenderung terlalu kencang",
      body: `${hardEasy.length} dari 3 easy run terakhir di atas target ${formatPace(paces.easyPaceSec)}–${formatPace(paces.easyPaceSec + 30)}/km${hrZones ? ` atau HR di atas ${hrZones[1]}` : ""}. 80% latihan sebaiknya benar-benar santai supaya sesi kualitas bisa maksimal.`,
    });
  }

  // 5. Beban akut vs kronis
  const kmIn = (from: ISODate, to: ISODate) => runs.filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + r.distanceKm, 0);
  const acute = kmIn(addDays(today, -6), today);
  const chronic = kmIn(addDays(today, -27), today) / 4;
  if (chronic >= 8) {
    const ratio = acute / chronic;
    if (ratio > 1.3)
      out.push({
        id: "load-high",
        tone: "warn",
        title: "Beban 7 hari naik tajam",
        body: `${formatKm(Math.round(acute * 10) / 10)} km minggu ini vs rata-rata ${formatKm(Math.round(chronic * 10) / 10)} km/minggu (×${ratio.toFixed(1)}). Jaga sesi berikutnya tetap santai; jangan menambah jarak.`,
      });
    else if (ratio < 0.7)
      out.push({
        id: "load-low",
        tone: "info",
        title: "Volume sedang turun",
        body: `${formatKm(Math.round(acute * 10) / 10)} km dalam 7 hari terakhir, di bawah rata-rata ${formatKm(Math.round(chronic * 10) / 10)} km/minggu. Kembali pelan ke jadwal; jangan langsung mengejar.`,
      });
  }

  // 6. Tidur / HRV beberapa hari terakhir
  const recentSig = input.signals.filter((s) => s.date > addDays(today, -4) && s.date <= today);
  const shortSleep = recentSig.filter((s) => s.sleepHours != null && s.sleepHours < 6).length;
  const lowHrv = recentSig.filter((s) => s.hrvDeltaPct != null && s.hrvDeltaPct <= -10).length;
  if (shortSleep >= 2 || lowHrv >= 2) {
    out.push({
      id: "recovery",
      tone: "warn",
      title: "Pemulihanmu sedang turun",
      body: `${shortSleep >= 2 ? `${shortSleep} malam tidur < 6 jam` : ""}${shortSleep >= 2 && lowHrv >= 2 ? " dan " : ""}${lowHrv >= 2 ? `HRV di bawah baseline ${lowHrv} hari` : ""} dalam 3 hari terakhir. Pace akan menurunkan intensitas saat perlu; prioritaskan tidur malam ini.`,
    });
  }

  // 7. Sesi terlewat minggu ini
  const mon = weekStart(today);
  const missed = workouts.filter(
    (w) => w.date >= mon && w.date < today && ["EASY", "STRIDES", "TEMPO", "INTERVAL", "LONG"].includes(w.type) && (w.status === "PLANNED" || w.status === "SKIPPED"),
  ).length;
  if (missed >= 2) {
    out.push({
      id: "missed",
      tone: "info",
      title: `${missed} sesi minggu ini terlewat`,
      body: "Jangan mengejar dengan menumpuk sesi. Lanjutkan dari sesi hari ini; konsistensi beberapa minggu lebih penting daripada satu minggu sempurna.",
    });
  }

  // 8. Progres: pace santai lebih cepat di HR serupa
  const withHr = runs.filter((r) => r.avgHr && r.distanceKm >= 3);
  const recent = withHr.filter((r) => diffDays(today, r.date) <= 14);
  const older = withHr.filter((r) => diffDays(today, r.date) > 14 && diffDays(today, r.date) <= 42);
  if (recent.length >= 2 && older.length >= 2) {
    const avg = (xs: RunRecord[], f: (r: RunRecord) => number) => xs.reduce((s, r) => s + f(r), 0) / xs.length;
    const hrNow = avg(recent, (r) => r.avgHr!);
    const similar = older.filter((r) => Math.abs(r.avgHr! - hrNow) <= 5);
    if (similar.length >= 2) {
      const gain = Math.round(avg(similar, (r) => r.durationSec / r.distanceKm) - avg(recent, (r) => r.durationSec / r.distanceKm));
      if (gain >= 5)
        out.push({
          id: "progress",
          tone: "good",
          title: "Kebugaran aerobikmu naik",
          body: `Di HR rata-rata ±${Math.round(hrNow)} bpm, pace-mu ${gain} detik/km lebih cepat dibanding 3–6 minggu lalu. Fondasi yang kamu bangun bekerja.`,
        });
    }
  }

  // 9. Sesi berikutnya
  const next = workouts
    .filter((w) => w.date > today && w.status === "PLANNED" && w.type !== "REST")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) {
    const hard = next.type === "TEMPO" || next.type === "INTERVAL" || next.type === "LONG";
    out.push({
      id: "next",
      tone: "info",
      title: `Berikutnya: ${workoutTitle(next)}, ${formatDateId(next.date).split(",")[0]}`,
      body: hard
        ? "Sesi penting. Tidur cukup malam sebelumnya, makan karbohidrat yang cukup, dan datang dalam kondisi segar."
        : "Sesi santai. Fokus konsisten dan nikmati larinya.",
      action: { label: "Lihat rencana", href: "/plan/" },
    });
  }

  return out;
}
