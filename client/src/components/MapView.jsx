import { Fragment, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { MessageSquare, Navigation } from "lucide-react";
import { initials, timeAgo, dayColor, distanceM, formatDistance, directionsUrl } from "../lib/format.js";

function placeIcon(label, color, active) {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${active ? "pin-active" : ""}" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SAFE_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Round photo pin with a name tag. `dx, dy` shift it when several people stand at the same spot. */
function personIcon(member, isMe, dx = 0, dy = 0) {
  const face = member.avatar && SAFE_IMG.test(member.avatar)
    ? `<img src="${member.avatar}" alt="" />`
    : escapeHtml(initials(member.name));
  const label = isMe ? "You" : escapeHtml(member.name.split(" ")[0]);
  return L.divIcon({
    className: "",
    html: `<div class="person-marker"><div class="person-pin" style="background:${member.color}">${face}</div><span class="person-tag">${label}</span></div>`,
    iconSize: [44, 58],
    iconAnchor: [22 - dx, 22 - dy],
    popupAnchor: [dx, -20 + dy],
  });
}

// Person markers hang below their point (photo + name tag + spread offset), so leave more room at the bottom.
const PAD = { paddingTopLeft: [50, 50], paddingBottomRight: [50, 90] };

/**
 * Fits the map to the visible places (and anyone sharing their location) whenever `fitKey` changes.
 * People are included so this fit never hides friends that FitPeople just zoomed out to show.
 */
function FitBounds({ places, people, fitKey, center }) {
  const map = useMap();
  useEffect(() => {
    const points = [...places, ...people].map((p) => [p.lat, p.lng]);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { ...PAD, maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
    else if (center) map.setView([center.lat, center.lng], 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

/**
 * Zooms out to include everyone: when someone starts sharing (a new person appears)
 * and whenever "Show everyone" is pressed (showAllKey changes).
 */
function FitPeople({ people, places, showAllKey }) {
  const map = useMap();
  const seen = useRef(new Set());
  const fit = () => {
    const pts = [...people.map((p) => [p.lat, p.lng]), ...places.map((p) => [p.lat, p.lng])];
    if (pts.length === 1) map.flyTo(pts[0], 15, { duration: 0.8 });
    else if (pts.length > 1) {
      const bounds = L.latLngBounds(pts);
      const opts = { ...PAD, maxZoom: 15 };
      const startedAt = Date.now();
      map.flyToBounds(bounds, { ...opts, duration: 0.8 });
      // The animation can be cut short when the layout shifts while the page is still loading
      // (the map resizes). If someone ended up off-screen, snap to the right view.
      map.once("moveend", () => {
        if (Date.now() - startedAt > 2000) return;
        const view = map.getBounds();
        if (!people.every((p) => view.contains([p.lat, p.lng]))) map.fitBounds(bounds, { ...opts, animate: false });
      });
    }
  };
  const ids = people.map((p) => p.userId).join(",");
  useEffect(() => {
    const fresh = people.some((p) => !seen.current.has(p.userId));
    seen.current = new Set(people.map((p) => p.userId));
    if (fresh) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  useEffect(() => {
    if (showAllKey) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllKey]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [target, map]);
  return null;
}

/** Leaflet needs a nudge when its container changes size (tabs, mobile layout). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** People within ~30 m of each other get spread in a small circle so every face is visible. */
function spreadOffsets(people) {
  const groups = [];
  for (const p of people) {
    const g = groups.find((grp) => distanceM(grp[0], p) < 30);
    if (g) g.push(p);
    else groups.push([p]);
  }
  const out = {};
  for (const g of groups) {
    g.forEach((p, i) => {
      if (g.length === 1) out[p.userId] = [0, 0];
      else {
        const angle = (2 * Math.PI * i) / g.length - Math.PI / 2;
        out[p.userId] = [Math.round(Math.cos(angle) * 26), Math.round(Math.sin(angle) * 26)];
      }
    });
  }
  return out;
}

export default function MapView({ places, center, members, locations, meId, selectedId, onSelect, fitKey, flyTarget, showAllKey, onMessage }) {
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const people = useMemo(() => Object.values(locations).filter((l) => memberById[l.userId]), [locations, memberById]);
  const offsets = useMemo(() => spreadOffsets(people), [people]);
  const me = locations[meId];

  // Number places within each day: 1, 2, 3...
  const numbered = useMemo(() => {
    const counters = {};
    return places.map((p) => {
      counters[p.day] = (counters[p.day] || 0) + 1;
      return { ...p, label: p.day === 0 ? "•" : counters[p.day] };
    });
  }, [places]);

  const routes = useMemo(() => {
    const byDay = {};
    for (const p of places) if (p.day > 0) (byDay[p.day] ||= []).push([p.lat, p.lng]);
    return Object.entries(byDay).filter(([, pts]) => pts.length > 1);
  }, [places]);

  const start = center ? [center.lat, center.lng] : places[0] ? [places[0].lat, places[0].lng] : [20.59, 78.96];

  return (
    <MapContainer center={start} zoom={center || places[0] ? 11 : 4} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AutoResize />
      <FitBounds places={places} people={people} fitKey={fitKey} center={center} />
      <FitPeople people={people} places={places} showAllKey={showAllKey} />
      <FlyTo target={flyTarget} />

      {routes.map(([day, pts]) => (
        <Polyline key={day} positions={pts} pathOptions={{ color: dayColor(Number(day)), weight: 3, dashArray: "6 8", opacity: 0.8 }} />
      ))}

      {numbered.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={placeIcon(p.label, dayColor(p.day), p.id === selectedId)}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
          zIndexOffset={p.id === selectedId ? 1000 : 0}
        >
          <Popup>
            <strong>{p.name}</strong>
            <div className="popup-day">{p.day === 0 ? "Idea (not scheduled)" : `Day ${p.day}`}</div>
            {p.note && <div>{p.note}</div>}
            {me && <div className="popup-day">{formatDistance(distanceM(me, p))} from you</div>}
            <a href={directionsUrl(p)} target="_blank" rel="noreferrer" className="popup-link"><Navigation size={13} /> Directions</a>
          </Popup>
        </Marker>
      ))}

      {people.map((loc) => {
        const m = memberById[loc.userId];
        const isMe = loc.userId === meId;
        const [dx, dy] = offsets[loc.userId] || [0, 0];
        return (
          <Fragment key={loc.userId}>
            {loc.accuracy > 30 && loc.accuracy < 3000 && (
              <Circle center={[loc.lat, loc.lng]} radius={loc.accuracy} pathOptions={{ color: m.color, weight: 1, fillOpacity: 0.08 }} />
            )}
            <Marker position={[loc.lat, loc.lng]} icon={personIcon(m, isMe, dx, dy)} zIndexOffset={isMe ? 2500 : 2000}>
              <Popup>
                <strong>{isMe ? "You" : m.name}</strong>
                <div className="popup-day">
                  <span className="live-dot" /> Live · updated {timeAgo(loc.ts)}
                  {loc.accuracy ? ` · ±${loc.accuracy < 1000 ? `${loc.accuracy} m` : `${(loc.accuracy / 1000).toFixed(1)} km`}` : ""}
                </div>
                {!isMe && me && <div>{formatDistance(distanceM(me, loc))} from you</div>}
                {!isMe && (
                  <div className="popup-actions">
                    <a href={directionsUrl(loc)} target="_blank" rel="noreferrer" className="popup-link"><Navigation size={13} /> Directions</a>
                    {onMessage && <button type="button" className="link-btn popup-link" onClick={() => onMessage(loc.userId)}><MessageSquare size={13} /> Message</button>}
                  </div>
                )}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
