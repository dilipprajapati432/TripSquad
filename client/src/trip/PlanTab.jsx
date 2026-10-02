import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../lib/api.js";
import { CloudSun, Droplets, GripVertical, Lightbulb, Map as MapIcon, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { dayDate, formatDay, dayColor, isoDay } from "../lib/format.js";
import { weatherIcon } from "../lib/icons.jsx";
import MapView from "../components/MapView.jsx";
import PlaceSearch from "../components/PlaceSearch.jsx";
import Avatar from "../components/Avatar.jsx";
import AIPlanner from "./AIPlanner.jsx";
import LiveBar from "./LiveBar.jsx";

// Which drop target is the pointer over? Prefer a place card (to insert before it),
// then the day list itself; fall back to the closest target when outside everything.
function collision(args) {
  const hits = pointerWithin(args);
  if (hits.length) {
    const place = hits.find((h) => !String(h.id).startsWith("day-"));
    return [place || hits[0]];
  }
  return closestCenter(args);
}

/** Photo of the place (from Wikipedia) with its number on top, or just the colored number. */
function PlaceThumb({ place, index }) {
  const [failed, setFailed] = useState(false);
  const num = <span className="place-num" style={{ background: dayColor(place.day) }}>{place.day === 0 ? <Lightbulb size={12} /> : index + 1}</span>;
  if (!place.photo || failed) return <span className="place-thumb place-thumb-empty">{num}</span>;
  return (
    <span className="place-thumb">
      <img src={place.photo} alt="" loading="lazy" onError={() => setFailed(true)} />
      {num}
    </span>
  );
}

function PlaceCard({ place, index, trip, member, selected, onSelect, onChange, onDelete, dragHandle, overlay, onProfile }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(place.note);

  return (
    <div className={`place ${selected ? "place-selected" : ""} ${overlay ? "place-overlay" : ""}`} onClick={() => onSelect?.(place)}>
      <button className="drag-handle" {...dragHandle} aria-label="Drag to reorder" onClick={(e) => e.stopPropagation()}><GripVertical size={16} /></button>
      <PlaceThumb place={place} index={index} />
      <div className="place-body">
        <div className="place-title">
          <strong>{place.name}</strong>
          {place.source === "ai" && <span className="badge badge-ai" title="Suggested by AI">AI</span>}
        </div>
        {editing ? (
          <div className="stack-sm" onClick={(e) => e.stopPropagation()}>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (timing, tickets, tips…)" autoFocus />
            <div className="row">
              <button className="btn btn-primary btn-sm" onClick={() => { onChange({ note }); setEditing(false); }}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setNote(place.note); setEditing(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          place.note && <p className="place-note">{place.note}</p>
        )}
        {!overlay && (
          <div className="place-actions" onClick={(e) => e.stopPropagation()}>
            <select value={place.day} onChange={(e) => onChange({ day: Number(e.target.value) })} aria-label="Move to day">
              <option value={0}>Ideas</option>
              {Array.from({ length: trip.days }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}
            </select>
            <button className="link-btn" onClick={() => { setNote(place.note || ""); setEditing(true); }}><StickyNote size={14} /> {place.note ? "Edit note" : "Note"}</button>
            <button className="icon-btn icon-btn-sm place-remove" onClick={onDelete} title="Remove place" aria-label={`Remove ${place.name}`}><Trash2 size={15} /></button>
            {member && <span className="added-by"><Avatar member={member} size={20} title={`Added by ${member.name}`} onClick={() => onProfile?.(member.id)} /></span>}
          </div>
        )}
      </div>
    </div>
  );
}

function SortablePlace(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.place.id });
  return (
    <div ref={setNodeRef} id={`place-${props.place.id}`} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}>
      <PlaceCard {...props} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  );
}

function DayColumn({ day, trip, children, count, onFocus, focused, forecast }) {
  const w = forecast && weatherIcon(forecast.code);
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  return (
    <section className={`day ${isOver ? "day-over" : ""}`} data-day={day} style={{ "--day": dayColor(day) }}>
      <button className={`day-head ${focused ? "day-head-active" : ""}`} onClick={onFocus}>
        <span className="day-dot" style={{ background: dayColor(day) }} />
        <strong>{day === 0 ? "Ideas" : `Day ${day}`}</strong>
        <span className="muted small">
          {day === 0 ? "not scheduled yet" : formatDay(dayDate(trip.startDate, day), { weekday: "short", day: "numeric", month: "short" })}
        </span>
        {w && (
          <span className="weather-chip" title={`${w.label}${forecast.rain != null ? `, ${forecast.rain}% chance of rain` : ""}`}>
            <w.Icon size={14} /> {forecast.max}°/{forecast.min}°{forecast.rain >= 30 && <span className="muted rain"><Droplets size={12} />{forecast.rain}%</span>}
          </span>
        )}
        <span className="muted small push">{count} {count === 1 ? "place" : "places"}</span>
      </button>
      <div ref={setNodeRef} className="day-list">
        {children}
        {count === 0 && <p className="drop-hint">Drag places here</p>}
      </div>
    </section>
  );
}

export default function PlanTab({ trip, setTrip, locations, aiEnabled, weather, onProfile, userId, share, onMessage }) {
  const [showAllKey, setShowAllKey] = useState(0);
  const [filterDay, setFilterDay] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  const memberById = useMemo(() => Object.fromEntries(trip.members.map((m) => [m.id, m])), [trip.members]);
  const days = useMemo(() => [0, ...Array.from({ length: trip.days }, (_, i) => i + 1)], [trip.days]);
  const byDay = useMemo(() => {
    const map = Object.fromEntries(days.map((d) => [d, []]));
    for (const p of trip.places) (map[p.day] ||= []).push(p);
    for (const d in map) map[d].sort((a, b) => a.order - b.order);
    return map;
  }, [trip.places, days]);

  // The owner shortened the trip while this day was selected
  useEffect(() => {
    if (filterDay !== "all" && filterDay > trip.days) setFilterDay("all");
  }, [filterDay, trip.days]);

  const visible = filterDay === "all" ? trip.places : byDay[filterDay] || [];
  const activePlace = trip.places.find((p) => p.id === activeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** Wait for a change; if the server refuses it, show why and put back what we showed optimistically. */
  async function run(promise, snapshot) {
    setError("");
    try {
      const d = await promise;
      if (d?.places) setTrip((t) => ({ ...t, places: d.places }));
    } catch (e) {
      setError(e.message);
      if (snapshot) setTrip((t) => ({ ...t, places: snapshot }));
    }
  }

  const addPlace = () => {
    const body = { name: pending.name, address: pending.address, lat: pending.lat, lng: pending.lng, day: pending.day, note: pending.note };
    setPending(null);
    setFlyTarget({ lat: body.lat, lng: body.lng });
    run(api(`/trips/${trip.id}/places`, { method: "POST", body }));
  };

  const updatePlace = (id, changes) => run(api(`/trips/${trip.id}/places/${id}`, { method: "PATCH", body: changes }));
  const deletePlace = (id) => {
    const snapshot = trip.places;
    setTrip((t) => ({ ...t, places: t.places.filter((p) => p.id !== id) })); // optimistic
    run(api(`/trips/${trip.id}/places/${id}`, { method: "DELETE" }), snapshot);
  };

  function onDragEnd({ active, over }) {
    setActiveId(null);
    if (!over) return;
    const place = trip.places.find((p) => p.id === active.id);
    if (!place) return;
    let targetDay;
    let targetIndex;
    if (String(over.id).startsWith("day-")) {
      targetDay = Number(String(over.id).slice(4));
      targetIndex = byDay[targetDay].length;
    } else {
      const overPlace = trip.places.find((p) => p.id === over.id);
      if (!overPlace) return;
      targetDay = overPlace.day;
      targetIndex = byDay[targetDay].findIndex((p) => p.id === over.id);
    }

    let ids;
    if (targetDay === place.day) {
      const list = byDay[targetDay].map((p) => p.id);
      const from = list.indexOf(place.id);
      const to = Math.min(targetIndex, list.length - 1); // dropped on the day itself = move to the end
      if (from === to) return;
      ids = arrayMove(list, from, to);
    } else {
      ids = byDay[targetDay].map((p) => p.id);
      ids.splice(targetIndex, 0, place.id);
    }

    // Optimistic update so the drop feels instant; the server then confirms for everyone
    const snapshot = trip.places;
    setTrip((t) => ({
      ...t,
      places: t.places.map((p) => (ids.includes(p.id) ? { ...p, day: targetDay, order: ids.indexOf(p.id) } : p)),
    }));
    run(api(`/trips/${trip.id}/places/reorder`, { method: "PUT", body: { day: targetDay, ids } }), snapshot);
  }

  const selectPlace = (p) => {
    setSelectedId(p.id);
    setFlyTarget({ lat: p.lat, lng: p.lng });
  };

  return (
    <div className="plan">
      <div className="plan-list">
        <div className="plan-tools">
          <PlaceSearch center={trip.center} onPick={(r) => setPending({ ...r, day: filterDay === "all" ? 0 : filterDay, note: "" })} />
          <button className="btn btn-secondary" onClick={() => setAiOpen(true)} title={aiEnabled ? "" : "Add an AI key on the server to enable"}>
            <Sparkles size={16} /> AI plan
          </button>
        </div>

        {pending && (
          <div className="card pending">
            <input value={pending.name} onChange={(e) => setPending({ ...pending, name: e.target.value })} aria-label="Place name" />
            <p className="muted small">{pending.address}</p>
            <div className="row-2">
              <select value={pending.day} onChange={(e) => setPending({ ...pending, day: Number(e.target.value) })}>
                <option value={0}>Ideas (not scheduled)</option>
                {days.slice(1).map((d) => <option key={d} value={d}>Day {d}</option>)}
              </select>
              <input value={pending.note} onChange={(e) => setPending({ ...pending, note: e.target.value })} placeholder="Note (optional)" />
            </div>
            <div className="row">
              <button className="btn btn-primary btn-sm" onClick={addPlace} disabled={!pending.name.trim()}>Add to trip</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {weather?.note && <p className="muted small inline-icon"><CloudSun size={14} /> Weather: {weather.note}</p>}
        <div className="chips">
          <button className={`chip ${filterDay === "all" ? "chip-active" : ""}`} onClick={() => setFilterDay("all")}>All</button>
          {days.map((d) => (
            <button key={d} className={`chip ${filterDay === d ? "chip-active" : ""}`} onClick={() => setFilterDay(d)}>
              <span className="day-dot" style={{ background: dayColor(d) }} />
              {d === 0 ? "Ideas" : `Day ${d}`}
            </button>
          ))}
        </div>

        <div className="plan-scroll">
        {trip.places.length === 0 && !pending && (
          <div className="empty">
            <div className="empty-icon"><MapIcon size={22} /></div>
            <p><strong>Your itinerary is empty.</strong></p>
            <p className="muted small">Search for a place above, or let AI draft a first plan. Everyone in the trip sees changes instantly.</p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
          {(filterDay === "all" ? days : [filterDay]).map((d) => (
            <DayColumn key={d} day={d} trip={trip} forecast={d > 0 ? weather?.days?.[isoDay(trip.startDate, d)] : null} count={byDay[d]?.length || 0} focused={filterDay === d} onFocus={() => setFilterDay(filterDay === d ? "all" : d)}>
              <SortableContext items={(byDay[d] || []).map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {(byDay[d] || []).map((p, i) => (
                  <SortablePlace
                    key={p.id}
                    place={p}
                    index={i}
                    trip={trip}
                    member={memberById[p.addedBy]}
                    selected={p.id === selectedId}
                    onSelect={selectPlace}
                    onChange={(changes) => updatePlace(p.id, changes)}
                    onDelete={() => deletePlace(p.id)}
                    onProfile={onProfile}
                  />
                ))}
              </SortableContext>
            </DayColumn>
          ))}
          <DragOverlay>
            {activePlace ? <PlaceCard place={activePlace} index={byDay[activePlace.day].indexOf(activePlace)} trip={trip} overlay /> : null}
          </DragOverlay>
        </DndContext>
        </div>
      </div>

      <div className="plan-right">
      <LiveBar
        trip={trip}
        userId={userId}
        locations={locations}
        share={share}
        onFocus={(l) => setFlyTarget({ lat: l.lat, lng: l.lng, n: Date.now() })}
        onShowAll={() => setShowAllKey((k) => k + 1)}
      />
      <div className="plan-map">
        <MapView
          places={visible}
          center={trip.center}
          members={trip.members}
          locations={locations}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
          fitKey={`${filterDay}-${visible.length}-${trip.id}`}
          flyTarget={flyTarget}
          meId={userId}
          showAllKey={showAllKey}
          onMessage={onMessage}
        />
      </div>
      </div>

      {aiOpen && (
        <AIPlanner
          trip={trip}
          aiEnabled={aiEnabled}
          onClose={() => setAiOpen(false)}
          onAdded={(places) => {
            setTrip((t) => ({ ...t, places }));
            setFilterDay("all");
          }}
        />
      )}
    </div>
  );
}
