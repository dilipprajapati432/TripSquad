import { useEffect, useState } from "react";
import { MapPin, Users } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import { distanceM, formatDistance, timeAgo } from "../lib/format.js";

/** Strip above the map: who is sharing live location right now. Tap someone to jump to them. */
export default function LiveBar({ trip, userId, locations, share, onFocus, onShowAll }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 10000); // refresh "updated 20s ago"
    return () => clearInterval(t);
  }, []);

  const memberById = Object.fromEntries(trip.members.map((m) => [m.id, m]));
  const me = locations[userId];
  const others = Object.values(locations).filter((l) => l.userId !== userId && memberById[l.userId]);
  const sorted = me ? [...others].sort((a, b) => distanceM(me, a) - distanceM(me, b)) : others;

  return (
    <div className="card live-bar">
      <span className="live-bar-title">
        {others.length || me ? <span className="live-dot" /> : <MapPin size={14} />} Live
      </span>

      {share.status === "locating" && <span className="muted small">Finding your location…</span>}
      {me && (
        <button className="live-person" onClick={() => onFocus(me)} title="Your position">
          <Avatar member={memberById[userId]} size={28} />
          <span><strong>You</strong><small>±{me.accuracy < 1000 ? `${me.accuracy} m` : `${(me.accuracy / 1000).toFixed(1)} km`}</small></span>
        </button>
      )}
      {sorted.map((l) => (
        <button key={l.userId} className="live-person" onClick={() => onFocus(l)} title={`Show ${memberById[l.userId].name} on the map`}>
          <Avatar member={memberById[l.userId]} size={28} />
          <span>
            <strong>{memberById[l.userId].name.split(" ")[0]}</strong>
            <small>{me ? formatDistance(distanceM(me, l)) : `updated ${timeAgo(l.ts)}`}</small>
          </span>
        </button>
      ))}

      {!me && others.length === 0 && share.status === "off" && (
        <span className="muted small">No one is sharing their location.</span>
      )}
      <span className="push row" style={{ flexWrap: "nowrap" }}>
        {(others.length > 0 || me) && <button className="btn btn-ghost btn-sm" onClick={onShowAll}><Users size={14} /> Show everyone</button>}
        {share.status === "off" && <button className="btn btn-secondary btn-sm" onClick={share.start}><MapPin size={14} /> Share mine</button>}
      </span>
    </div>
  );
}
