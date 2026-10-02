import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ChevronLeft, MapPin, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import { FOOD_LABELS } from "../lib/profile.js";
import { makeAvatar } from "../lib/image.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import Avatar from "../components/Avatar.jsx";
import Modal from "../components/Modal.jsx";

/** Permanently delete the account (asks for the password first). */
function DeleteAccount() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/users/me", { method: "DELETE", body: { password } });
      logout();
      window.location.replace("/"); // fresh start on the home page (not the login form)
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const close = () => { if (!busy) { setOpen(false); setPassword(""); setError(""); } };
  return (
    <section className="card stack danger-zone">
      <div>
        <h3>Delete account</h3>
        <p className="muted small">Removes your profile, photo, contact details and private messages. Trips only you are in are deleted. You'll leave shared trips; messages and expenses you added there stay for your friends as "Deleted user".</p>
      </div>
      <div><button type="button" className="btn btn-danger" onClick={() => setOpen(true)}><Trash2 size={16} /> Delete my account</button></div>
      {open && (
        <Modal title="Delete your account?" onClose={close}>
          <form className="stack" onSubmit={confirm}>
            <p className="small">This can't be undone. If you still owe or are owed money in a trip, settle up first.</p>
            <label>
              Enter your password to confirm
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
              <button className="btn btn-danger-solid" disabled={busy || !password}>{busy ? "Deleting…" : "Delete forever"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/** "Trip members / Only me" switch shown next to private fields */
function Visibility({ value, onChange }) {
  return (
    <label className="vis-toggle" title="Who can see this">
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "auto", padding: "0.15rem 0.4rem", fontSize: "0.78rem" }}>
        <option value="members">Trip members</option>
        <option value="private">Only me</option>
      </select>
    </label>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null); // { avatar, avatarThumb } when changed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const [loadError, setLoadError] = useState("");
  const loadProfile = () => {
    setLoadError("");
    api("/users/me")
      .then(({ user: u }) => setForm({ ...u, languages: (u.languages || []).join(", ") }))
      .catch((e) => setLoadError(e.message));
  };
  useEffect(loadProfile, []);

  if (!form && loadError) {
    return (
      <main className="page narrow">
        <div className="card empty">
          <p className="error">{loadError}</p>
          <button className="btn btn-secondary" onClick={loadProfile}>Try again</button>
        </div>
      </main>
    );
  }
  if (!form) return <main className="page page-profile"><div className="skeleton" style={{ height: 420 }} /></main>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setVis = (k) => (v) => setForm({ ...form, visibility: { ...form.visibility, [k]: v } });
  const shownAvatar = photo ? photo.avatar : form.avatar;

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPhoto(await makeAvatar(file));
    } catch (err) {
      toast(err.message, { type: "error" });
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      name: form.name,
      bio: form.bio,
      homeCity: form.homeCity,
      languages: form.languages,
      food: form.food,
      phone: form.phone,
      emergencyName: form.emergencyName,
      emergencyPhone: form.emergencyPhone,
      paymentInfo: form.paymentInfo,
      visibility: form.visibility,
    };
    if (photo) Object.assign(body, photo);
    try {
      const { user: saved } = await api("/users/me", { method: "PATCH", body });
      setUser(saved);
      setForm({ ...saved, languages: saved.languages.join(", ") });
      setPhoto(null);
      toast("Profile saved", { type: "success" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const removePhoto = () => setPhoto({ avatar: "", avatarThumb: "" });

  return (
    <main className="page page-profile">
      <div className="page-header">
        <div>
          <Link to="/" className="back"><ChevronLeft size={14} /> My trips</Link>
          <h1>My profile</h1>
          <p className="muted">Friends in your trips see this, so they know who's who and how to reach you.</p>
        </div>
      </div>

      <form className="profile-grid" onSubmit={save}>
        <aside className="card profile-side">
          <div className="profile-side-body">
            <Avatar member={{ name: form.name || "?", avatar: shownAvatar, color: "#0f766e" }} size={92} />
            <strong style={{ fontSize: "1.15rem" }}>{form.name || "Your name"}</strong>
            {form.homeCity && <span className="muted small inline-icon"><MapPin size={13} /> {form.homeCity}</span>}
            {form.bio && <p className="small">{form.bio}</p>}
            <div className="photo-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Camera size={15} /> {shownAvatar ? "Change photo" : "Add photo"}</button>
              {shownAvatar && <button type="button" className="btn btn-ghost btn-sm" onClick={removePhoto}>Remove</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            {photo && <span className="small muted">New photo — press Save to keep it</span>}
            <hr className="divider" style={{ width: "100%" }} />
            <span className="small muted">{user.email}</span>
          </div>
        </aside>

        <div className="stack">
          <section className="card stack">
            <h3>About you</h3>
            <label>
              Name
              <input value={form.name} onChange={set("name")} required minLength={2} maxLength={50} />
            </label>
            <label>
              <span>Short bio <span className="hint">({160 - (form.bio?.length || 0)} left)</span></span>
              <textarea rows={2} value={form.bio} onChange={set("bio")} maxLength={160} placeholder="Beach person, early riser, will plan the food stops" />
            </label>
            <div className="row-2">
              <label>
                Home city
                <input value={form.homeCity} onChange={set("homeCity")} placeholder="Ahmedabad, India" maxLength={80} />
              </label>
              <label>
                <span>Languages <span className="hint">(comma separated)</span></span>
                <input value={form.languages} onChange={set("languages")} placeholder="English, Hindi, Gujarati" />
              </label>
            </div>
            <div className="stack-sm">
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Food preference</span>
              <div className="chips">
                {Object.entries(FOOD_LABELS).map(([value, label]) => (
                  <button type="button" key={value} className={`chip ${form.food === value ? "chip-active" : ""}`} onClick={() => setForm({ ...form, food: form.food === value ? "" : value })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card stack">
            <h3>Contact & safety</h3>
            <p className="muted small">Useful when the group splits up. Choose who can see each one.</p>
            <label>
              <span className="field-head">Phone (with country code) <Visibility value={form.visibility.phone} onChange={setVis("phone")} /></span>
              <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" maxLength={25} />
            </label>
            <div>
              <span className="field-head" style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                Emergency contact <Visibility value={form.visibility.emergency} onChange={setVis("emergency")} />
              </span>
              <div className="row-2">
                <input value={form.emergencyName} onChange={set("emergencyName")} placeholder="Name (e.g. Mom)" maxLength={60} aria-label="Emergency contact name" />
                <input type="tel" value={form.emergencyPhone} onChange={set("emergencyPhone")} placeholder="+91 99999 11111" maxLength={25} aria-label="Emergency contact phone" />
              </div>
            </div>
            <label>
              <span className="field-head">How friends can pay you back <Visibility value={form.visibility.payment} onChange={setVis("payment")} /></span>
              <input value={form.paymentInfo} onChange={set("paymentInfo")} placeholder="e.g. PayPal dp@mail.com · Revolut @dp · UPI dp@okbank" maxLength={120} />
              <span className="hint">Shown next to "Settle up" when someone owes you.</span>
            </label>
          </section>

          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
            <span className="muted small">Only people who share a trip with you can see your profile.</span>
          </div>
        </div>
      </form>
      <div className="profile-danger"><DeleteAccount /></div>
    </main>
  );
}
