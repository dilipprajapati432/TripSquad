import { env } from "../config/env.js";
import { setBounded } from "../utils/cache.js";

// Free forecast from Open-Meteo (no API key). Forecasts only go ~16 days ahead,
// so trips further away get "available closer to the date".
// https://open-meteo.com/en/docs

const cache = new Map(); // key -> { at, data }
const CACHE_MS = 3 * 60 * 60 * 1000;
const HORIZON_DAYS = 15;

const ymd = (d) => d.toISOString().slice(0, 10);

/** Returns { days: { "2026-12-12": { code, max, min, rain } }, note } */
export async function tripForecast({ lat, lng, startDate, endDate }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86400000);
  const start = new Date(Math.max(new Date(startDate).getTime(), today.getTime()));
  const end = new Date(Math.min(new Date(endDate).getTime(), horizon.getTime()));

  if (new Date(endDate) < today) return { days: {}, note: "This trip is over." };
  if (start > end) return { days: {}, note: "Forecast appears about 2 weeks before the trip." };

  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${ymd(start)},${ymd(end)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    start_date: ymd(start),
    end_date: ymd(end),
  });
  const res = await fetch(`${env.weatherUrl}?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Weather service error (${res.status})`);
  const json = await res.json();
  const d = json.daily || {};
  const days = {};
  (d.time || []).forEach((date, i) => {
    days[date] = {
      code: d.weather_code?.[i],
      max: Math.round(d.temperature_2m_max?.[i]),
      min: Math.round(d.temperature_2m_min?.[i]),
      rain: d.precipitation_probability_max?.[i] ?? null,
    };
  });
  const data = { days, note: new Date(endDate) > horizon ? "Later days appear closer to the date." : "" };
  setBounded(cache, key, { at: Date.now(), data });
  return data;
}
