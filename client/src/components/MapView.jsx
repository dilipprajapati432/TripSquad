import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { initials, timeAgo, dayColor } from "../lib/format.js";


function placeIcon(label, color, active) {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${active ? "pin-active" : ""}" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function personIcon(member) {
  return L.divIcon({
    className: "",
    html: `<div class="person-pin" style="background:${member.color}">${initials(member.name)}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/** Fits the map to the visible places whenever `fitKey` changes. */
function FitBounds({ points, fitKey, center }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
    else if (center) map.setView([center.lat, center.lng], 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
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

export default function MapView({ places, center, members, locations, selectedId, onSelect, fitKey, flyTarget }) {
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

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
      <FitBounds points={places.map((p) => [p.lat, p.lng])} fitKey={fitKey} center={center} />
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
          </Popup>
        </Marker>
      ))}

      {Object.values(locations).map((loc) => {
        const m = memberById[loc.userId];
        if (!m) return null;
        return (
          <Fragment key={loc.userId}>
            {loc.accuracy > 30 && loc.accuracy < 2000 && (
              <Circle center={[loc.lat, loc.lng]} radius={loc.accuracy} pathOptions={{ color: m.color, weight: 1, fillOpacity: 0.08 }} />
            )}
            <Marker position={[loc.lat, loc.lng]} icon={personIcon(m)} zIndexOffset={2000}>
              <Popup>
                <strong>{m.name}</strong>
                <div className="popup-day">Live · {timeAgo(loc.ts)}</div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
