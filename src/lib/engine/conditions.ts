export interface HourCondition {
  hour: number; // 0–23 waktu lokal
  tempC: number;
  humidity: number; // %
  aqi: number | null; // US AQI
}

export interface ConditionAssessment {
  preferredHour: number;
  aqi: number | null;
  heatIndexC: number;
  flagged: boolean;
  reasons: string[];
  bestHour: number | null;
  bestAqi: number | null;
  suggestIndoor: boolean;
}

export const AQI_LIMIT = 150;
export const HEAT_INDEX_LIMIT_C = 38;

/** Heat index (Rothfusz), input °C dan %RH, output °C. */
export function heatIndexC(tempC: number, rh: number): number {
  const t = (tempC * 9) / 5 + 32;
  if (t < 80) return tempC;
  const hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh;
  return Math.round((((hi - 32) * 5) / 9) * 10) / 10;
}

const badness = (h: HourCondition) =>
  (h.aqi ?? 50) / AQI_LIMIT + Math.max(0, heatIndexC(h.tempC, h.humidity) - 30) / (HEAT_INDEX_LIMIT_C - 30);

/** Nilai kondisi di jam lari pilihan, dan cari jam alternatif terbaik (04.00–20.00). */
export function assessConditions(hours: HourCondition[], preferredHour = 6): ConditionAssessment | null {
  const at = hours.find((h) => h.hour === preferredHour);
  if (!at) return null;
  const hi = heatIndexC(at.tempC, at.humidity);
  const reasons: string[] = [];
  if (at.aqi != null && at.aqi > AQI_LIMIT) reasons.push(`AQI ${at.aqi} jam ${preferredHour}`);
  if (hi > HEAT_INDEX_LIMIT_C) reasons.push(`Heat index ${Math.round(hi)}°C`);
  const flagged = reasons.length > 0;

  const candidates = hours
    .filter((h) => h.hour >= 4 && h.hour <= 20)
    .filter((h) => (h.aqi == null || h.aqi <= AQI_LIMIT) && heatIndexC(h.tempC, h.humidity) <= HEAT_INDEX_LIMIT_C)
    .sort((a, b) => badness(a) - badness(b) || Math.abs(a.hour - preferredHour) - Math.abs(b.hour - preferredHour));
  const best = flagged ? candidates[0] ?? null : at;

  return {
    preferredHour,
    aqi: at.aqi,
    heatIndexC: hi,
    flagged,
    reasons,
    bestHour: best ? best.hour : null,
    bestAqi: best ? best.aqi : null,
    suggestIndoor: flagged && !best,
  };
}
