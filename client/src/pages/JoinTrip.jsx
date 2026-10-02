import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { CalendarDays, CircleAlert, MapPin, ShieldAlert, Users } from "lucide-react";
import { dateRange } from "../lib/format.js";
import Cover, { CoverCredit } from "../components/Cover.jsx";
import { PHONE_RE } from "../lib/profile.js";
import { useAuth } from "../context/AuthContext.jsx";
import BackLink from "../components/BackLink.jsx";

export default function JoinTrip() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const [contact, setContact] = useState({ phone: "", emergencyName: "", emergencyPhone: "" });
  const setC = (k) => (e) => setContact({ ...contact, [k]: e.target.value });

  useEffect(() => {
    api(`/trips/invite/${encodeURIComponent(code)}`)
      .then((d) => {
        if (d.invite.alreadyMember) navigate(`/trips/${d.invite.tripId}`, { replace: true });
        else setInvite(d.invite);
      })
      .catch((e) => setError(e.message));
  }, [code, navigate]);

  async function join() {
    setBusy(true);
    setError("");
    try {
      // This trip requires contact details: save the missing ones to the profile first
      if (invite.missing?.length) {
        const body = {};
        if (invite.missing.includes("phone")) body.phone = contact.phone.trim();
        if (invite.missing.includes("emergency")) Object.assign(body, { emergencyName: contact.emergencyName.trim(), emergencyPhone: contact.emergencyPhone.trim() });
        for (const [k, v] of Object.entries(body)) {
          if (!v) throw new Error("Please fill in all the fields above to join.");
          if (k !== "emergencyName" && !PHONE_RE.test(v)) throw new Error("Phone numbers can only contain numbers, spaces, + ( ) -");
        }
        const { user } = await api("/users/me", { method: "PATCH", body });
        setUser(user);
      }
      const { trip } = await api(`/trips/join/${encodeURIComponent(code)}`, { method: "POST" });
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <main className="page page-join">
      <div className="back-row"><BackLink fallback="/" fallbackLabel="My trips" /></div>
      <div className="card join-card">
        {error && !invite ? (
          <>
            <div className="empty-icon"><CircleAlert size={22} /></div>
            <p className="error">{error}</p>
            <Link to="/" className="btn btn-secondary">Back to my trips</Link>
          </>
        ) : !invite ? (
          <div className="spinner" />
        ) : (
          <>
            <Cover cover={invite.cover} theme={invite.theme} className="join-cover" eager>
              <div className="trip-hero-shade" />
              <div className="join-cover-text">
                <span className="eyebrow eyebrow-light">You're invited to join</span>
                <h1>{invite.name}</h1>
                <div className="trip-meta trip-meta-light">
                  <span className="inline-icon"><MapPin size={15} /> {invite.destination}</span>
                  <span className="inline-icon"><CalendarDays size={15} /> {dateRange(invite.startDate, invite.endDate)}</span>
                </div>
              </div>
              <CoverCredit cover={invite.cover} />
            </Cover>
            <div className="join-card-body">
            <p className="muted inline-icon" style={{ justifyContent: "center" }}>
              <Users size={16} /> {invite.memberNames.join(", ")}
              {invite.memberCount > invite.memberNames.length && ` and ${invite.memberCount - invite.memberNames.length} more`}
            </p>
            {invite.missing?.length > 0 && !invite.full && (
              <div className="require-box">
                <strong className="inline-icon"><ShieldAlert size={15} /> This trip asks every member for contact details</strong>
                <p className="small muted">So the group can reach you — or someone close to you — if you get separated. Saved to your profile; only trip-mates can see it.</p>
                {invite.missing.includes("phone") && (
                  <label>
                    Your phone (with country code)
                    <input type="tel" value={contact.phone} onChange={setC("phone")} placeholder="+91 98765 43210" maxLength={25} />
                  </label>
                )}
                {invite.missing.includes("emergency") && (
                  <div className="stack-sm">
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Emergency contact</span>
                    <div className="row-2">
                      <input value={contact.emergencyName} onChange={setC("emergencyName")} placeholder="Name (e.g. Mom)" maxLength={60} aria-label="Emergency contact name" />
                      <input type="tel" value={contact.emergencyPhone} onChange={setC("emergencyPhone")} placeholder="+91 99999 11111" maxLength={25} aria-label="Emergency contact phone" />
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && <p className="error">{error}</p>}
            {invite.full ? (
              <p className="error">This trip is full.</p>
            ) : (
              <button className="btn btn-primary btn-block" onClick={join} disabled={busy}>
                {busy ? "Joining…" : invite.missing?.length ? "Save & join trip" : "Join trip"}
              </button>
            )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
