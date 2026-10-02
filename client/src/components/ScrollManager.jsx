import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll behaviour between pages, like a normal website:
 * - Opening a new page starts at the top (or at #section when the link has one).
 * - Back / Forward returns to where you were on that page, even if its content loads a moment later.
 * - Switching tabs inside a page (?tab=money) doesn't move the page.
 */
const positions = new Map(); // location.key -> scrollY

export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const prev = useRef(location);
  const activeKey = useRef(location.key); // scroll events only count for the page on screen

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  // Remember the scroll position of the current page as the user scrolls
  // (not on leaving: by then the next page has already been scrolled to the top)
  useEffect(() => {
    const key = location.key;
    const save = () => key === activeKey.current && positions.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [location.key]);

  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = location;
    activeKey.current = location.key;
    if (from.pathname === location.pathname && from.hash === location.hash && from.key !== location.key && navType !== "POP") return; // tab change
    if (from.key === location.key) return;

    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) {
        // Newer browsers return a Promise from scrollIntoView, so don't return its result:
        // an effect may only return a clean-up function.
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    const target = navType === "POP" ? positions.get(location.key) ?? 0 : 0;
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    if (!target) return;

    // The page may still be loading its content (e.g. the trip list): keep trying for a moment,
    // and stop as soon as the user scrolls themselves.
    let stopped = false;
    const stop = () => (stopped = true);
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });
    const started = performance.now();
    let raf = requestAnimationFrame(function retry() {
      if (stopped || performance.now() - started > 2000) return;
      if (Math.abs(window.scrollY - target) > 2) window.scrollTo({ top: target, behavior: "instant" });
      if (Math.abs(window.scrollY - target) <= 2 && document.documentElement.scrollHeight >= target + window.innerHeight) return;
      raf = requestAnimationFrame(retry);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [location, navType]);

  return null;
}
