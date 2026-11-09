"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { assessConditions, timeAdvice } from "./engine";
import { load, subscribe, type State } from "./store";

/** State Pace dari perangkat. null saat render statis / sebelum hydrate. */
export function usePace(): State | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

/** Jalankan aksi store dengan penanganan error untuk UI. */
export function useRun() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(<T,>(fn: () => T): T | null => {
    setError(null);
    try {
      return fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      return null;
    }
  }, []);
  return { run, error, setError };
}

interface ForecastResponse {
  hourly?: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[] };
}
interface AirResponse {
  hourly?: { time: string[]; us_aqi: (number | null)[] };
}

/**
 * Saran jam lari dari cuaca + AQI (Open-Meteo, gratis, tanpa API key, mendukung CORS).
 * Gagal → null; app tetap jalan.
 */
export function useTimeAdvice(lat?: number, lon?: number, tz?: string, date?: string): string | null {
  const [advice, setAdvice] = useState<string | null>(null);
  useEffect(() => {
    if (lat == null || lon == null || !tz || !date) return;
    const key = `pace:wx:${lat.toFixed(2)},${lon.toFixed(2)},${date}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached !== null) return setAdvice(cached || null);
    } catch {
      /* abaikan */
    }
    let alive = true;
    const q = `latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}&start_date=${date}&end_date=${date}`;
    Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${q}&hourly=temperature_2m,relative_humidity_2m`).then((r) => r.json() as Promise<ForecastResponse>),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=us_aqi`)
        .then((r) => r.json() as Promise<AirResponse>)
        .catch(() => null),
    ])
      .then(([f, a]) => {
        const h = f.hourly;
        if (!h) return;
        const hours = h.time.map((t, i) => ({
          hour: Number(t.slice(11, 13)),
          tempC: h.temperature_2m[i],
          humidity: h.relative_humidity_2m[i],
          aqi: a?.hourly?.us_aqi?.[i] ?? null,
        }));
        const text = timeAdvice(assessConditions(hours, 6));
        try {
          sessionStorage.setItem(key, text ?? "");
        } catch {
          /* abaikan */
        }
        if (alive) setAdvice(text);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lat, lon, tz, date]);
  return advice;
}
