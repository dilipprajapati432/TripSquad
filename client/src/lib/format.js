// Money arrives from the API in minor units (paise/cents). 245000 -> "₹2,450.00"
export function money(minor, currency) {
  const value = (minor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDate(d, opts = { day: "numeric", month: "short" }) {
  return new Date(d).toLocaleDateString("en-IN", opts);
}

/**
 * Trip and expense dates are calendar days stored as UTC midnight ("2026-10-01T00:00Z").
 * Always show them in UTC, or someone in New York would see "30 Sept".
 */
export function formatDay(d, opts = { day: "numeric", month: "short" }) {
  return new Date(d).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
}

export function dateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  return `${formatDay(s)} – ${formatDay(e, { day: "numeric", month: "short", year: sameYear ? "numeric" : undefined })}`;
}

/** Date of day N of the trip (day 1 = start date), as a UTC calendar date — show it with formatDay. */
export function dayDate(start, day) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d;
}

/** Today's date in the user's own time zone as "YYYY-MM-DD" (for date inputs). */
export function localToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

// Each day of the trip gets its own color on the map and in the list (day 0 = Ideas)
export const DAY_COLORS = ["#667085", "#0f766e", "#c2410c", "#1d4ed8", "#7e22ce", "#b45309", "#be185d", "#15803d", "#4338ca", "#0e7490"];
export const dayColor = (day) => DAY_COLORS[day % DAY_COLORS.length];

// Trip accent colors (index is stored on the trip). `soft` is a tinted background for chips/tiles.
export const THEMES = [
  { name: "Teal", color: "#0f766e", deep: "#134e4a", soft: "rgba(15,118,110,.12)" },
  { name: "Clay", color: "#c2410c", deep: "#7c2d12", soft: "rgba(194,65,12,.12)" },
  { name: "Ochre", color: "#b45309", deep: "#78350f", soft: "rgba(180,83,9,.12)" },
  { name: "Forest", color: "#15803d", deep: "#14532d", soft: "rgba(21,128,61,.12)" },
  { name: "Indigo", color: "#4338ca", deep: "#312e81", soft: "rgba(67,56,202,.12)" },
  { name: "Ocean", color: "#1d4ed8", deep: "#1e3a8a", soft: "rgba(29,78,216,.12)" },
  { name: "Rose", color: "#be185d", deep: "#831843", soft: "rgba(190,24,93,.12)" },
  { name: "Slate", color: "#475467", deep: "#1d2939", soft: "rgba(71,84,103,.14)" },
];
export const themeOf = (i) => THEMES[i] || THEMES[0];

const DAY = 86400000;
const startOfDay = (d) => new Date(new Date(d).toDateString()).getTime();
// Calendar day of a stored trip date, and "today" for the user, on the same UTC scale
const calendarDay = (d) => { const x = new Date(d); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
const localDay = () => { const x = new Date(); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };

/** "In 12 days", "Tomorrow", "Day 2 of 4", "Ended 3 days ago" */
export function tripStatus(start, end) {
  const today = localDay();
  const s = calendarDay(start);
  const e = calendarDay(end);
  const total = Math.round((e - s) / DAY) + 1;
  if (today < s) {
    const n = Math.round((s - today) / DAY);
    return { label: n === 1 ? "Tomorrow" : `In ${n} days`, state: "upcoming", days: n };
  }
  if (today <= e) return { label: `Day ${Math.round((today - s) / DAY) + 1} of ${total}`, state: "live" };
  const n = Math.round((today - e) / DAY);
  return { label: n === 1 ? "Ended yesterday" : `Ended ${n} days ago`, state: "past" };
}

export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function clockTime(d) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(d) {
  const day = startOfDay(d);
  const today = startOfDay(Date.now());
  if (day === today) return "Today";
  if (day === today - DAY) return "Yesterday";
  return formatDate(d, { weekday: "short", day: "numeric", month: "short" });
}

/** Local YYYY-MM-DD for a trip day (matches the weather API's keys). */
export function isoDay(start, day) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

/** Distance in meters between two {lat, lng} points (haversine formula). */
export function distanceM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m) {
  if (m < 50) return "right here";
  if (m < 1000) return `${Math.round(m / 10) * 10} m away`;
  if (m < 100000) return `${(m / 1000).toFixed(1)} km away`;
  return `${Math.round(m / 1000)} km away`;
}

export const directionsUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

/** Two-letter mark for a trip tile: "Goa Beach Week" -> "GB" */
export function tripMark(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "T";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}
