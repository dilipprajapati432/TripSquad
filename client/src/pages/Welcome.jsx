import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, Info, Lock, ShieldCheck, Compass, UserRound } from "lucide-react";
import { api } from "../lib/api.js";
import { makeAvatar } from "../lib/image.js";
import { FOOD_LABELS, PHONE_RE, profileCompleteness } from "../lib/profile.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import Avatar from "../components/Avatar.jsx";

const STEPS = [
  { id: "about", icon: UserRound, title: "About you", why: "Helps your trip-mates recognise you, especially people you haven't met yet." },
  { id: "safety", icon: ShieldCheck, title: "Contact & safety", why: "If the group splits up or something goes wrong, your trip-mates can reach you — or someone close to you." },
  { id: "prefs", icon: Compass, title: "Travel preferences", why: "Makes planning meals and settling up money easy for everyone." },
];

/**
 * Setup wizard shown right after sign-up: 3 short screens, each skippable.
 * Everything saved here is also editable later on the My profile page.
 */
export default function Welcome() {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from || "/";
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef(null);
  const [form, setForm] = useState(() => ({
    homeCity: user.homeCity || "",
    languages: (user.languages || []).join(", "),
    bio: user.bio || "",
    phone: user.phone || "",
    emergencyName: user.emergencyName || "",
    emergencyPhone: user.emergencyPhone || "",
    food: user.food || "",
    paymentInfo: user.paymentInfo || "",
  }));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const preview = { ...user, ...form, languages: form.languages.split(",").filter((l) => l.trim()), avatarThumb: photo?.avatarThumb ?? user.avatarThumb };
  const { percent } = profileCompleteness(preview);

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

  function validate() {
    if (step !== 1) return "";
    if (form.phone && !PHONE_RE.test(form.phone)) return "Phone can only contain numbers, spaces, + ( ) -";
    if (form.emergencyPhone && !PHONE_RE.test(form.emergencyPhone)) return "Emergency phone can only contain numbers, spaces, + ( ) -";
    if (Boolean(form.emergencyName) !== Boolean(form.emergencyPhone)) return "Add both the name and the phone number of your emergency contact.";
    return "";
  }

  // Save what's on the current screen, then move on (or finish)
  async function save({ finish = false, skip = false } = {}) {
    setError("");
    const problem = skip ? "" : validate();
    if (problem) return setError(problem);
    const body = {};
    if (!skip) {
      if (step === 0) Object.assign(body, { homeCity: form.homeCity, languages: form.languages, bio: form.bio }, photo || {});
      if (step === 1) Object.assign(body, { phone: form.phone, emergencyName: form.emergencyName, emergencyPhone: form.emergencyPhone });
      if (step === 2) Object.assign(body, { food: form.food, paymentInfo: form.paymentInfo });
    }
    if (finish) body.onboarded = true;
    setBusy(true);
    try {
      if (Object.keys(body).length) {
        const { user: saved } = await api("/users/me", { method: "PATCH", body });
        setUser(saved);
      }
      if (finish) {
        toast(percent >= 100 ? "Your travel profile is complete" : "You're all set! You can finish your profile any time.", { type: "success" });
        navigate(next, { replace: true });
      } else setStep(step + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <main className="page narrow-wide">
      <div className="card wizard">
        <div className="wizard-top">
          <div className="wizard-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((x, i) => (
              <span key={x.id} className={`wizard-dot ${i < step ? "done" : ""} ${i === step ? "active" : ""}`}>
                {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
            ))}
          </div>
          <span className="muted small">Profile {percent}% complete</span>
        </div>
        <div className="bar" style={{ marginBottom: "1.2rem" }}><span style={{ width: `${percent}%` }} /></div>

        <div className="wizard-head">
          <span className="wizard-icon"><s.icon size={20} /></span>
          <div>
            <p className="muted small" style={{ margin: 0 }}>Step {step + 1} of {STEPS.length}</p>
            <h2 style={{ margin: 0 }}>{step === 0 ? `Welcome, ${user.name.split(" ")[0]}. ` : ""}{s.title}</h2>
          </div>
        </div>
        <p className="why"><Info size={15} /> <span>{s.why}</span></p>

        <div className="stack" key={step}>
          {step === 0 && (
            <>
              <div className="row" style={{ gap: "1rem" }}>
                <Avatar member={{ name: user.name, avatar: photo?.avatarThumb || user.avatarThumb, color: "#0f766e" }} size={72} />
                <div className="stack-sm">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Camera size={15} /> {photo || user.avatarThumb ? "Change photo" : "Add a photo"}</button>
                  <span className="hint">A real photo makes it easy to spot you at the meeting point.</span>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
              </div>
              <div className="row-2">
                <label>
                  Home city
                  <input value={form.homeCity} onChange={set("homeCity")} placeholder="Ahmedabad, India" maxLength={80} autoFocus />
                </label>
                <label>
                  <span>Languages <span className="hint">(comma separated)</span></span>
                  <input value={form.languages} onChange={set("languages")} placeholder="English, Hindi" />
                </label>
              </div>
              <label>
                <span>One line about you <span className="hint">(optional)</span></span>
                <input value={form.bio} onChange={set("bio")} placeholder="Early riser, loves street food" maxLength={160} />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label>
                Your phone (with country code)
                <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" maxLength={25} autoFocus />
              </label>
              <div className="stack-sm">
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Emergency contact</span>
                <div className="row-2">
                  <input value={form.emergencyName} onChange={set("emergencyName")} placeholder="Name (e.g. Mom)" maxLength={60} aria-label="Emergency contact name" />
                  <input type="tel" value={form.emergencyPhone} onChange={set("emergencyPhone")} placeholder="+91 99999 11111" maxLength={25} aria-label="Emergency contact phone" />
                </div>
              </div>
              <p className="hint inline-icon" style={{ alignItems: "flex-start" }}><Lock size={12} style={{ marginTop: 3, flexShrink: 0 }} /> Only people in your trips can see these, and you can hide each one from My profile at any time. Some trips require them to join.</p>
            </>
          )}

          {step === 2 && (
            <>
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
              <label>
                How friends can pay you back
                <input value={form.paymentInfo} onChange={set("paymentInfo")} placeholder="e.g. PayPal you@mail.com · Revolut @you · UPI you@bank" maxLength={120} />
                <span className="hint">Shown next to "Settle up" when someone owes you.</span>
              </label>
            </>
          )}
        </div>

        {error && <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p>}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={16} /> Back</button>
          ) : <span />}
          <div className="row">
            <button type="button" className="link-btn" onClick={() => save({ skip: true, finish: last })} disabled={busy}>
              {last ? "Skip & finish" : "Skip for now"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => save({ finish: last })} disabled={busy}>
              {busy ? "Saving…" : last ? "Finish setup" : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
      <p className="center muted small" style={{ marginTop: "0.8rem" }}>You can change all of this later from <strong>menu → My profile</strong>.</p>
    </main>
  );
}
