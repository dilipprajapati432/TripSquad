import { themeOf, tripMark } from "../lib/format.js";

/** Square tile with the trip's initials in its accent color (used instead of cover images). */
export default function TripMark({ name, theme, size = 40 }) {
  const t = themeOf(theme);
  return (
    <span
      className="trip-mark"
      style={{ width: size, height: size, fontSize: size * 0.38, "--mark": t.color }}
      aria-hidden="true"
    >
      {tripMark(name)}
    </span>
  );
}
