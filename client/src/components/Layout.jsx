import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

import ThemeToggle from "./ThemeToggle.jsx";
import Wordmark from "./Wordmark.jsx";

// In-page sections, in the same order as on the landing page
// Short noun labels, matching each section's small heading on the page
const SECTIONS = [
  ["features", "Features"],
  ["splitting", "Bill splitting"],
  ["why", "Why TripSquad"],
  ["how", "How it works"],
  ["faq", "FAQ"],
];

/** Highlights the link of the section currently on screen (landing page only). */
function useActiveSection(enabled) {
  const [active, setActive] = useState("");
  useEffect(() => {
    if (!enabled || !("IntersectionObserver" in window)) return;
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" } // the section crossing the middle of the screen
    );
    els.forEach((el) => io.observe(el));
    // Above the first section (the hero): nothing is active
    const onTop = () => window.scrollY < 200 && setActive("");
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, [enabled]);
  return active;
}

/**
 * Header for the public pages (landing, privacy, terms).
 * On the landing page the links scroll to each section; on other pages they lead back to it.
 * Phones get a menu button instead of the row of links.
 */
export function SiteHeader({ sections = false }) {
  const { user } = useAuth();
  const active = useActiveSection(sections);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const href = (id) => (sections ? `#${id}` : `/#${id}`);
  const links = SECTIONS.map(([id, label]) =>
    sections ? (
      <a key={id} href={href(id)} className={active === id ? "is-active" : ""} aria-current={active === id ? "true" : undefined} onClick={() => setOpen(false)}>{label}</a>
    ) : (
      <Link key={id} to={href(id)} onClick={() => setOpen(false)}>{label}</Link>
    )
  );

  return (
    <header className="topbar site-header" ref={menuRef}>
      <Link to="/" className="brand">
        <Wordmark />
      </Link>
      <nav className="site-nav" aria-label="Page sections">{links}</nav>
      <div className="topbar-right">
        <ThemeToggle />
        {user ? (
          <Link to="/" className="btn btn-primary btn-sm">My trips</Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm site-login">Log in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
          </>
        )}
        <button type="button" className="icon-btn site-menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav id="site-menu" className="site-menu" aria-label="Menu">
          {links}
          {!user && <Link to="/login" className="site-menu-login" onClick={() => setOpen(false)}>Log in</Link>}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/" className="brand"><Wordmark /></Link>
          <p>Plan group trips together: one shared map, one chat, one fair bill.</p>
        </div>
        <nav className="site-footer-links" aria-label="Footer">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <p>© {new Date().getFullYear()} TripSquad. All rights reserved.</p>
      </div>
    </footer>
  );
}
