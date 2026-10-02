import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Link2, MapPin, Plus, Sparkles, UserPlus, Users, Wallet, X } from "lucide-react";
import { api } from "../lib/api.js";
import { dateRange, localToday, money, greeting, tripStatus, THEMES } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import Avatar from "../components/Avatar.jsx";
import Cover from "../components/Cover.jsx";
import ThemePicker from "../components/ThemePicker.jsx";
import { profileCompleteness } from "../lib/profile.js";

const HIDE_KEY = "tripsquad_hide_profile_card";

/** "Your travel profile is 40% complete" — until it's done (or dismissed for a week). */
function ProfileCard({ user }) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => {
    try {
      return Date.now() < Number(localStorage.getItem(HIDE_KEY) || 0);
    } catch {
      return false;
    }
  });
  const { percent, missing } = profileCompleteness(user);
  if (percent >= 100 || hidden) return null;
  const important = missing.filter((m) => m.key === "phone" || m.key === "emergency");
  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + 7 * 86400000));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };
  return (
    <section className="card profile-card reveal">
      <div className="profile-ring" style={{ "--p": percent }}><span>{percent}%</span></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Your travel profile is {percent}% complete</strong>
        <p className="small muted" style={{ margin: "2px 0 6px" }}>
          {important.length ? "Your trip-mates can't reach you or your emergency contact yet." : "A few details left to help your trip-mates."}
        </p>
        <div className="chips">
          {missing.map((m) => (
            <span key={m.key} className={`chip chip-static ${m.key === "phone" || m.key === "emergency" ? "chip-warn" : ""}`}>{m.label}</span>
          ))}
        </div>
      </div>
      <div className="row" style={{ flexShrink: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/welcome", { state: { from: "/" } })}>Complete profile</button>
        <button className="icon-btn" onClick={hide} title="Hide for a week" aria-label="Hide for a week"><X size={16} /></button>
      </div>
    </section>
  );
}


function CreateTripModal({ currencies, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ name: "", destination: "", startDate: localToday(), endDate: localToday(), currency: "INR", theme: Math.floor(Math.random() * THEMES.length) }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { trip } = await api("/trips", { method: "POST", body: form });
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Plan a new trip" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label>
          Trip name
          <input value={form.name} onChange={set("name")} placeholder="Goa with the gang" required autoFocus maxLength={80} />
        </label>
        <label>
          Where are you going?
          <span className="input-icon">
            <MapPin size={16} />
            <input value={form.destination} onChange={set("destination")} placeholder="Goa, India" required maxLength={120} />
          </span>
          <span className="hint">We'll find a cover photo and centre the map on it.</span>
        </label>
        <div className="row-2">
          <label>
            Start
            <input type="date" value={form.startDate} onChange={set("startDate")} required />
          </label>
          <label>
            End
            <input type="date" value={form.endDate} min={form.startDate} onChange={set("endDate")} required />
          </label>
        </div>
        <div className="row-2">
          <label>
            Trip currency
            <select value={form.currency} onChange={set("currency")}>
              {currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="stack-sm">
            <span className="field-label">Trip color</span>
            <ThemePicker value={form.theme} onChange={(theme) => setForm({ ...form, theme })} />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Creating your trip…" : "Create trip"}</button>
      </form>
    </Modal>
  );
}

/** Small "Join with a code" popover in the page header. */
function JoinButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  function join(e) {
    e.preventDefault();
    // Accept a full invite link or just the code
    const c = code.trim().split("/join/").pop().split(/[?#]/)[0];
    if (c) navigate(`/join/${c}`);
  }
  return (
    <div className="popover-wrap" ref={ref}>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <UserPlus size={16} /> Join a trip
      </button>
      {open && (
        <form className="popover card" onSubmit={join}>
          <strong>Got an invite?</strong>
          <p className="small muted">Paste the link a friend sent you, or just the code.</p>
          <span className="input-icon">
            <Link2 size={16} />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="tripsquad.app/join/…" autoFocus aria-label="Invite link or code" />
          </span>
          <button className="btn btn-primary btn-block" disabled={!code.trim()}>Join trip</button>
        </form>
      )}
    </div>
  );
}

function StatusChip({ status, onPhoto = false }) {
  return <span className={`status-chip status-${status.state} ${onPhoto ? "status-on-photo" : ""}`}>{status.label}</span>;
}

/** Big card for the next (or current) trip. */
function FeaturedTrip({ t }) {
  const status = tripStatus(t.startDate, t.endDate);
  const live = status.state === "live";
  return (
    <Link to={`/trips/${t.id}`} className="featured card reveal">
      <Cover cover={t.cover} theme={t.theme} className="featured-cover" eager>
        <StatusChip status={status} onPhoto />
      </Cover>
      <div className="featured-body">
        <span className="eyebrow">{live ? "Happening now" : "Up next"}</span>
        <h2>{t.name}</h2>
        <div className="trip-meta">
          <span className="inline-icon"><MapPin size={15} /> {t.destination}</span>
          <span className="inline-icon"><CalendarDays size={15} /> {dateRange(t.startDate, t.endDate)}</span>
        </div>
        <div className="featured-count">
          {live ? (
            <><strong>{status.label.split(" of ")[0]}</strong><span>of {t.days}</span></>
          ) : (
            <><strong>{status.days}</strong><span>{status.days === 1 ? "day to go" : "days to go"}</span></>
          )}
        </div>
        <div className="featured-foot">
          <div className="avatars">
            {t.members.map((m) => <Avatar key={m.id} member={m} size={32} />)}
            {t.memberCount > t.members.length && <span className="avatar avatar-more" style={{ width: 32, height: 32 }}>+{t.memberCount - t.members.length}</span>}
          </div>
          <span className="btn btn-primary">Open trip <ArrowRight size={16} /></span>
        </div>
      </div>
    </Link>
  );
}

function TripCard({ t, index }) {
  const status = tripStatus(t.startDate, t.endDate);
  return (
    <Link to={`/trips/${t.id}`} className={`trip-card card reveal ${status.state === "past" ? "trip-card-past" : ""}`} style={{ "--i": index }}>
      <Cover cover={t.cover} theme={t.theme} className="trip-card-cover">
        <StatusChip status={status} onPhoto />
        {t.isOwner && <span className="owner-chip">Owner</span>}
      </Cover>
      <div className="trip-card-body">
        <strong className="trip-card-name truncate">{t.name}</strong>
        <span className="muted small inline-icon truncate"><MapPin size={14} /> {t.destination}</span>
        <span className="muted small inline-icon"><CalendarDays size={14} /> {dateRange(t.startDate, t.endDate)} · {t.days} {t.days === 1 ? "day" : "days"}</span>
      </div>
      <div className="trip-card-foot">
        <div className="avatars">
          {t.members.map((m) => <Avatar key={m.id} member={m} size={26} />)}
          {t.memberCount > t.members.length && <span className="avatar avatar-more" style={{ width: 26, height: 26 }}>+{t.memberCount - t.members.length}</span>}
        </div>
        <div className="trip-card-meta">
          <span title="Places"><MapPin size={14} /> {t.placeCount}</span>
          <span title="Total spent"><Wallet size={14} /> {money(t.totalSpent, t.currency)}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyDashboard({ onCreate }) {
  return (
    <section className="empty-hero card reveal">
      <div className="empty-art" aria-hidden="true">
        <span className="art-card art-1" />
        <span className="art-card art-2" />
        <span className="art-card art-3"><MapPin size={22} /></span>
      </div>
      <h2>Plan your first trip</h2>
      <p className="muted">Create a trip, share the invite link, and plan the days, the chat and the money together — live.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn-primary btn-lg" onClick={onCreate}><Plus size={18} /> Create a trip</button>
      </div>
      <ul className="empty-steps">
        <li><span><Sparkles size={16} /></span>Draft the days with the AI planner</li>
        <li><span><Users size={16} /></span>Invite friends with one link</li>
        <li><span><Wallet size={16} /></span>Split costs in any currency</li>
      </ul>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState(null);
  const [meta, setMeta] = useState({ currencies: ["INR"] });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api("/trips").then((d) => setTrips(d.trips)).catch((e) => setError(e.message));
    api("/util/meta").then(setMeta).catch(() => {});
  }, []);

  const isPast = (t) => tripStatus(t.startDate, t.endDate).state === "past";
  const upcoming = (trips || []).filter((t) => !isPast(t)).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const past = (trips || []).filter(isPast).sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  const [next, ...later] = upcoming;
  const first = user.name.split(" ")[0];

  return (
    <main className="page">
      <header className="page-header dash-header">
        <div>
          <p className="eyebrow">{greeting()}, {first}</p>
          <h1>{next ? "Your trips" : "Where to next?"}</h1>
        </div>
        <div className="row">
          <JoinButton />
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> New trip</button>
        </div>
      </header>

      <ProfileCard user={user} />

      {error && <p className="error">{error}</p>}
      {!trips && !error && (
        <>
          <div className="skeleton" style={{ height: 260, marginBottom: 24 }} />
          <div className="trip-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 280 }} />)}</div>
        </>
      )}
      {trips?.length === 0 && <EmptyDashboard onCreate={() => setCreating(true)} />}

      {next && <FeaturedTrip t={next} />}

      {later.length > 0 && (
        <section>
          <h2 className="section-title">Coming up <span className="count">{later.length}</span></h2>
          <div className="trip-grid">{later.map((t, i) => <TripCard key={t.id} t={t} index={i} />)}</div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="section-title">Past trips <span className="count">{past.length}</span></h2>
          <div className="trip-grid">{past.map((t, i) => <TripCard key={t.id} t={t} index={i} />)}</div>
        </section>
      )}

      {creating && <CreateTripModal currencies={meta.currencies} onClose={() => setCreating(false)} />}
    </main>
  );
}
