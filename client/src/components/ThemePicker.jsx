import { Check } from "lucide-react";
import { THEMES } from "../lib/format.js";

/** Row of solid color swatches for the trip accent color. */
export default function ThemePicker({ value, onChange }) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Trip color">
      {THEMES.map((t, i) => (
        <button
          type="button"
          key={t.name}
          role="radio"
          aria-checked={value === i}
          className={`theme-swatch ${value === i ? "theme-swatch-active" : ""}`}
          style={{ "--swatch": t.color }}
          onClick={() => onChange(i)}
          title={t.name}
          aria-label={t.name}
        >
          {value === i && <Check size={14} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
