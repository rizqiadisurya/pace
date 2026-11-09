import "server-only";
import type { HourCondition } from "./engine";

/**
 * Cuaca + kualitas udara per jam dari Open-Meteo (gratis, tanpa API key).
 * https://open-meteo.com/en/docs dan https://open-meteo.com/en/docs/air-quality-api
 * Gagal → null; agent tetap jalan tanpa penyesuaian cuaca.
 */
const cache = new Map<string, { at: number; data: HourCondition[] | null }>();
const TTL_MS = 30 * 60 * 1000;

interface ForecastResponse {
  hourly?: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[] };
}
interface AirResponse {
  hourly?: { time: string[]; us_aqi: (number | null)[] };
}

export async function getHourlyConditions(
  lat: number,
  lon: number,
  date: string,
  timezone: string,
): Promise<HourCondition[] | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const common = `latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(timezone)}&start_date=${date}&end_date=${date}`;
  try {
    const [fRes, aRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${common}&hourly=temperature_2m,relative_humidity_2m`, {
        signal: AbortSignal.timeout(4000),
      }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${common}&hourly=us_aqi`, {
        signal: AbortSignal.timeout(4000),
      }),
    ]);
    if (!fRes.ok) throw new Error(`forecast ${fRes.status}`);
    const f = (await fRes.json()) as ForecastResponse;
    const a = aRes.ok ? ((await aRes.json()) as AirResponse) : null;
    const h = f.hourly;
    if (!h) throw new Error("no hourly data");
    const data: HourCondition[] = h.time.map((t, i) => ({
      hour: Number(t.slice(11, 13)),
      tempC: h.temperature_2m[i],
      humidity: h.relative_humidity_2m[i],
      aqi: a?.hourly?.us_aqi?.[i] ?? null,
    }));
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    cache.set(key, { at: Date.now(), data: null });
    return null;
  }
}
