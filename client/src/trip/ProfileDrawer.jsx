import { useEffect, useRef, useState } from "react";
import { CalendarDays, CircleCheck, CreditCard, Languages, Luggage, MapPin, MessageSquare, Phone, ShieldAlert, Target, Utensils, X } from "lucide-react";
import { api } from "../lib/api.js";
import { FOOD_LABELS } from "../lib/profile.js";
import { money, formatDate } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";

const digits = (phone) => phone.replace(/[^0-9]/g, "");

function Info({ icon: Icon, label, children }) {
  return (
    <div className="info-row">
      <span className="info-icon"><Icon size={16} /></span>
      <div>
        <div className="info-label">{label}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Slide-in panel with a trip-mate's profile, contact buttons and what you owe each other. */
export default function ProfileDrawer({ userId, trip, me, online, onClose, onMessage }) {
  const [data, setData] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState("");
  const member = trip.members.find((m) => m.id === userId);
  const isMe = userId === me;
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    let alive = true;
    api(`/users/${userId}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    api(`/trips/${trip.id}/expenses/summary`)
      .then((s) => {
        if (!alive) return;
        const owe = s.payments.find((p) => p.from === me && p.to === userId);
        const owed = s.payments.find((p) => p.from === userId && p.to === me);
        setBalance(owe ? -owe.amount : owed ? owed.amount : 0);
      })
      .catch(() => {});
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [userId, trip.id, me]);

  const u = data?.user;
  const first = (member?.name || u?.name || "").split(" ")[0];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`${member?.name || "Profile"}`}>
        <div className="drawer-top">
          <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="drawer-avatar">
            <Avatar member={{ ...member, avatar: u?.avatar || member?.avatar }} size={96} online={online.includes(userId)} />
          </div>
          {error && <p className="error">{error}</p>}
          {!u && !error && <div className="skeleton" style={{ height: 200 }} />}
          {u && (
            <>
              <div>
                <h2 style={{ marginBottom: 2 }}>{u.name} {isMe && <span className="badge">You</span>}</h2>
                <div className="muted small">
                  {member?.role === "owner" ? "Trip owner" : "Member"} · {online.includes(userId) ? "online now" : "offline"}
                </div>
                {u.bio && <p style={{ marginTop: "0.6rem" }}>{u.bio}</p>}
              </div>

              {!isMe && (
                <div className="row">
                  <button className="btn btn-primary btn-sm" onClick={() => onMessage(userId)}><MessageSquare size={15} /> Message</button>
                  {u.phone && <a className="btn btn-secondary btn-sm" href={`tel:${u.phone.replace(/\s/g, "")}`}><Phone size={15} /> Call</a>}
                  {u.phone && (
                    <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${digits(u.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                  )}
                </div>
              )}

              {!isMe && balance !== null && (
                <div className="balance-box">
                  {balance === 0 ? (
                    <span className="inline-icon"><CircleCheck size={16} className="pos" /> You and {first} are even.</span>
                  ) : balance < 0 ? (
                    <span>You owe {first} <strong className="neg">{money(-balance, trip.currency)}</strong></span>
                  ) : (
                    <span>{first} owes you <strong className="pos">{money(balance, trip.currency)}</strong></span>
                  )}
                  {balance < 0 && u.paymentInfo && <div className="small muted" style={{ marginTop: 4 }}>Pay via: {u.paymentInfo}</div>}
                </div>
              )}

              <div className="info-list">
                {u.homeCity && <Info icon={MapPin} label="From">{u.homeCity}</Info>}
                {u.languages?.length > 0 && <Info icon={Languages} label="Speaks">{u.languages.join(", ")}</Info>}
                {u.food && <Info icon={Utensils} label="Food">{FOOD_LABELS[u.food] || u.food}</Info>}
                {u.phone && <Info icon={Phone} label="Phone">{u.phone}</Info>}
                {(u.emergencyName || u.emergencyPhone) && (
                  <Info icon={ShieldAlert} label="Emergency contact">
                    {u.emergencyName} {u.emergencyPhone && <a href={`tel:${u.emergencyPhone.replace(/\s/g, "")}`}>{u.emergencyPhone}</a>}
                  </Info>
                )}
                {u.paymentInfo && <Info icon={CreditCard} label="Payment">{u.paymentInfo}</Info>}
                {member?.budget > 0 && <Info icon={Target} label="Trip budget">{money(member.budget, trip.currency)}</Info>}
                {data.sharedTrips?.length > 1 && (
                  <Info icon={Luggage} label="Trips together">{data.sharedTrips.map((t) => t.name).join(" · ")}</Info>
                )}
                {u.memberSince && <Info icon={CalendarDays} label="On TripSquad since">{formatDate(u.memberSince, { month: "long", year: "numeric" })}</Info>}
              </div>

              {!u.homeCity && !u.bio && !u.phone && !u.languages?.length && (
                <p className="muted small">{isMe ? "Your profile is empty — add details from the menu → My profile." : `${first} hasn't filled in their profile yet.`}</p>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
