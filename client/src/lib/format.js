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

export function dateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${formatDate(s)} – ${formatDate(e, { day: "numeric", month: "short", year: sameYear ? "numeric" : undefined })}`;
}

/** Date of day N of the trip (day 1 = start date). */
export function dayDate(start, day) {
  const d = new Date(start);
  d.setDate(d.getDate() + day - 1);
  return d;
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

export const CATEGORY_ICONS = {
  food: "🍽️",
  stay: "🏨",
  transport: "🚕",
  activity: "🎟️",
  shopping: "🛍️",
  other: "🧾",
};

// Each day of the trip gets its own color on the map and in the list (day 0 = Ideas)
export const DAY_COLORS = ["#64748b", "#0f766e", "#e4572e", "#2e86ab", "#8e44ad", "#d97706", "#db2777", "#16a34a", "#4f46e5", "#b45309"];
export const dayColor = (day) => DAY_COLORS[day % DAY_COLORS.length];
