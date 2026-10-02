import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye, EyeOff, Map as MapIcon, MessageSquare, Sparkles, Sun, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import BackLink from "../components/BackLink.jsx";

/** Decorative preview of the app (plain markup, not a screenshot) shown next to the login form. */
function AppPreview() {
  const stops = [
    ["#0f766e", "Baga Beach", "10:00"],
    ["#c2410c", "Fort Aguada", "13:30"],
    ["#1d4ed8", "Sunset at Chapora", "18:00"],
  ];
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-card preview-plan">
        <div className="preview-head"><strong>Day 2</strong><span>Sat, 14 Dec</span><span className="weather-chip"><Sun size={13} /> 31°</span></div>
        {stops.map(([c, name, time], i) => (
          <div key={name} className="preview-stop">
            <span className="place-num" style={{ background: c }}>{i + 1}</span>
            <span>{name}</span>
            <span className="muted">{time}</span>
          </div>
        ))}
      </div>
      <div className="preview-card preview-chat">
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: "#be185d" }}>RS</span>
        <div className="bubble">Landing at 10:40, see you at the hotel</div>
      </div>
      <div className="preview-card preview-money">
        <span className="stat-icon tint-green"><Wallet size={16} /></span>
        <div><span className="muted small">Aman pays you</span><strong className="pos">₹1,450.00</strong></div>
      </div>
      <div className="preview-card preview-live">
        <span className="live-dot" /> 4 friends sharing location
      </div>
    </div>
  );
}

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo123";

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      // No navigate() here: once `user` is set, the /login and /register routes redirect —
      // new accounts to the setup wizard first, everyone else back to where they were going.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin() {
    setError("");
    setBusy(true);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-hero">
        <div className="back-row"><BackLink fallback="/" fallbackLabel="Home" /></div>
        <span className="eyebrow">Group travel, planned together</span>
        <h1>One place for the whole trip — <span className="text-brand">the plan, the chat and the money.</span></h1>
        <p>Build the itinerary on a shared map, vote on plans, see where everyone is and split every bill, even across currencies. Everyone sees changes instantly.</p>
        <ul className="feature-list">
          {[
            [MapIcon, "tint-teal", "Shared day-by-day itinerary"],
            [MessageSquare, "tint-blue", "Group and private chat"],
            [Wallet, "tint-amber", "Fair splits, fewest payments"],
            [Sparkles, "tint-violet", "AI trip planner"],
          ].map(([Icon, tint, t]) => (
            <li key={t}><span className={`stat-icon ${tint}`}><Icon size={16} /></span>{t}</li>
          ))}
        </ul>
        <AppPreview />
      </section>
      <form className="card auth-card" onSubmit={submit}>
        <div>
          <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
          <p className="muted small">{isLogin ? "Log in to see your trips." : "Free, and it takes less than a minute."}</p>
        </div>
        {!isLogin && (
          <label>
            Name
            <input value={form.name} onChange={set("name")} placeholder="Your name" required minLength={2} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required autoComplete="email" />
        </label>
        <label>
          Password
          <span className="pw-field">
          <input
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={set("password")}
            placeholder={isLogin ? "Your password" : "At least 8 characters"}
            required
            minLength={isLogin ? 1 : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
          <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"} title={showPw ? "Hide password" : "Show password"}>
            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </button>
        {isLogin && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <button type="button" className="btn btn-secondary btn-block" onClick={demoLogin} disabled={busy}>
              🚀 Try Demo Account
            </button>
          </>
        )}
        <p className="muted small center">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link to={isLogin ? "/register" : "/login"} state={location.state}>
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
      </form>
    </main>
  );
}
