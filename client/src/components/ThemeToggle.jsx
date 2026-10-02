import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getTheme } from "../lib/theme.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };
  return (
    <button className="icon-btn" onClick={flip} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle dark mode">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
