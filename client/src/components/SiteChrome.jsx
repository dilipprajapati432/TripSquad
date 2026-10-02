import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export const GITHUB_URL = "https://github.com/dilipprajapati432";
export const PORTFOLIO_URL = "https://dilipcodes.me";

/** Header for the public pages (landing, privacy, terms). `sections` shows the in-page links. */
export function SiteHeader({ sections = false }) {
  const { user } = useAuth();
  return (
    <header className="topbar site-header">
      <Link to="/" className="brand" aria-label="TripSquad home">
        <Logo /> <span>TripSquad</span>
      </Link>
      {sections && (
        <nav className="site-nav" aria-label="Page sections">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </nav>
      )}
      <div className="topbar-right">
        <ThemeToggle />
        {user ? (
          <Link to="/" className="btn btn-primary btn-sm">My trips</Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
          </>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/" className="brand"><Logo /> <span>TripSquad</span></Link>
          <p className="muted small">Plan group trips together: one shared map, one chat, one fair bill.</p>
        </div>
        <nav className="site-footer-links" aria-label="Footer">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer">Portfolio</a>
        </nav>
      </div>
      <p className="site-footer-note muted small">© {new Date().getFullYear()} TripSquad. Built with React, Node.js, Socket.io and MongoDB.</p>
    </footer>
  );
}
