import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-hero">
        <h1>Plan trips together, live.</h1>
        <p>Shared itinerary on a map, group polls, live locations and fair expense splitting — in one place.</p>
        <ul className="hero-list">
          <li>🗺️ Plan day by day with friends in real time</li>
          <li>📍 See where everyone is during the trip</li>
          <li>💸 Split costs in any currency, settle in fewest payments</li>
          <li>✨ Let AI draft your itinerary</li>
        </ul>
      </section>
      <form className="card auth-card" onSubmit={submit}>
        <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
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
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder={isLogin ? "Your password" : "At least 8 characters"}
            required
            minLength={isLogin ? 1 : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </button>
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
