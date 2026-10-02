import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy, MessageSquare, TriangleAlert } from "lucide-react";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import { useUI } from "../context/UIContext.jsx";
import Avatar from "../components/Avatar.jsx";

export default function PeopleTab({ trip, userId, online, meta, onProfile, onMessage }) {
  const navigate = useNavigate();
  const { toast, confirm } = useUI();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join/${trip.inviteCode}`;

  async function copy() {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({ title: trip.name, text: `Join our trip "${trip.name}" on TripSquad`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share */
    }
  }

  async function resetLink() {
    const ok = await confirm({ title: "Reset invite link?", message: "The old link will stop working. People already in the trip stay in.", confirmText: "Reset link" });
    if (!ok) return;
    try {
      await api(`/trips/${trip.id}/invite/reset`, { method: "POST" });
      toast("New invite link created", { type: "success" });
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  }

  async function removeMember(m) {
    const self = m.id === userId;
    const ok = await confirm({
      title: self ? `Leave "${trip.name}"?` : `Remove ${m.name}?`,
      message: self ? "You'll lose access to the plan, chat and expenses of this trip." : `${m.name.split(" ")[0]} will lose access to this trip. They can rejoin with the invite link.`,
      confirmText: self ? "Leave trip" : "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/trips/${trip.id}/members/${m.id}`, { method: "DELETE" });
      if (self) navigate("/", { replace: true });
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  }

  const sorted = [...trip.members].sort((a, b) => (b.id === userId) - (a.id === userId) || online.includes(b.id) - online.includes(a.id));

  return (
    <div className="people">
      <section className="card stack">
        <h3>Invite friends</h3>
        <p className="muted small">Anyone with this link can join the trip (max {meta.maxMembers || 30} people).</p>
        <div className="invite-box">
          <code>{link}</code>
          <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}</button>
        </div>
        <div className="row">
          <a
            className="btn btn-whatsapp btn-sm"
            href={`https://wa.me/?text=${encodeURIComponent(`Join our trip "${trip.name}" on TripSquad: ${link}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on WhatsApp
          </a>
          {trip.isOwner && <button className="link-btn" onClick={resetLink}>Reset invite link</button>}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>People ({trip.members.length})</h3>
          <span className="muted small">{trip.members.filter((m) => online.includes(m.id)).length} online</span>
        </div>
        <ul className="list">
          {sorted.map((m) => (
            <li
              key={m.id}
              className="person-row"
              onClick={() => onProfile(m.id)}
              role="button"
              tabIndex={0}
              aria-label={`Open ${m.name}'s profile`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onProfile(m.id))}
            >
              <Avatar member={m} size={42} online={online.includes(m.id)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{m.name}</strong> {m.id === userId && <span className="muted">(you)</span>}
                <span className="muted small block">
                  {m.role === "owner" ? "Owner" : "Member"} · {online.includes(m.id) ? "online now" : "offline"}
                  {m.budget > 0 && ` · budget ${money(m.budget, trip.currency)}`}
                </span>
                {!m.hasEmergency && (
                  <span className="warn-chip" title="No emergency contact on their profile">
                    <TriangleAlert size={12} /> No emergency contact
                    {m.id === userId && <> · <Link to="/profile" onClick={(e) => e.stopPropagation()}>add yours</Link></>}
                  </span>
                )}
              </span>
              <span className="row" onClick={(e) => e.stopPropagation()}>
                {m.id !== userId && <button className="icon-btn icon-btn-bordered" onClick={() => onMessage(m.id)} title={`Message ${m.name}`} aria-label={`Message ${m.name}`}><MessageSquare size={16} /></button>}
                {m.role !== "owner" && (m.id === userId || trip.isOwner) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => removeMember(m)}>{m.id === userId ? "Leave" : "Remove"}</button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {trip.members.some((m) => !m.hasEmergency) && (
          <p className="small warn-box" style={{ marginTop: "0.6rem" }}>
            <TriangleAlert size={14} /> {trip.members.filter((m) => !m.hasEmergency).length} of {trip.members.length} people have no emergency contact yet.
            {trip.isOwner && !trip.requireContact && " You can require it in trip settings."}
          </p>
        )}
        <p className="muted small">Tap someone to see their profile. People can leave once their balance is settled.</p>
      </section>
    </div>
  );
}
