// Utilitas tanggal berbasis string "YYYY-MM-DD" (tanpa jam), aman dari isu timezone.

export type ISODate = string;

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

/** 0 = Senin ... 6 = Minggu */
export function dayOfWeek(d: ISODate): number {
  return (toUTC(d).getUTCDay() + 6) % 7;
}

export function weekStart(d: ISODate): ISODate {
  return addDays(d, -dayOfWeek(d));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** Tanggal hari ini di timezone tertentu, mis. "Asia/Jakarta". */
export function todayInTz(tz: string, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA memberi format YYYY-MM-DD
}

export const DAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const DAY_LONG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function formatDateId(d: ISODate): string {
  const [, m, day] = d.split("-").map(Number);
  return `${DAY_LONG[dayOfWeek(d)]}, ${day} ${MONTH_SHORT[m - 1]}`;
}
