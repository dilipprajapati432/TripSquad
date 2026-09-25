// Turn database documents into clean JSON for the frontend.

export const MEMBER_COLORS = [
  "#e4572e", "#2e86ab", "#3bb273", "#f2a541", "#8e44ad", "#e84393",
  "#16a085", "#d35400", "#2c3e50", "#c0392b", "#27ae60", "#2980b9",
];

export function serializePlace(p) {
  return {
    id: p._id.toString(),
    name: p.name,
    address: p.address,
    note: p.note,
    lat: p.lat,
    lng: p.lng,
    day: p.day,
    order: p.order,
    addedBy: p.addedBy ? p.addedBy.toString() : null,
    source: p.source,
  };
}

export function serializePlaces(trip) {
  return [...trip.places]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map(serializePlace);
}

/** `trip.members.user` must be populated with User docs. */
export function serializeTrip(trip, viewerId) {
  const isOwner = trip.isOwner(viewerId);
  return {
    id: trip._id.toString(),
    name: trip.name,
    destination: trip.destination,
    center: trip.center?.lat != null ? { lat: trip.center.lat, lng: trip.center.lng } : null,
    startDate: trip.startDate,
    endDate: trip.endDate,
    days: trip.dayCount(),
    currency: trip.currency,
    inviteCode: trip.inviteCode,
    isOwner,
    members: trip.members.map((m, i) => ({
      id: (m.user._id || m.user).toString(),
      name: m.user.name || "Member",
      role: m.role,
      budget: m.budget,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    })),
    places: serializePlaces(trip),
  };
}

export function serializeTripSummary(trip, viewerId) {
  return {
    id: trip._id.toString(),
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    memberCount: trip.members.length,
    placeCount: trip.places.length,
    isOwner: trip.isOwner(viewerId),
  };
}

export function serializeExpense(e) {
  return {
    id: e._id.toString(),
    kind: e.kind,
    description: e.description,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    rate: e.rate,
    amountBase: e.amountBase,
    paidBy: e.paidBy.toString(),
    splits: e.splits.map((s) => ({ user: s.user.toString(), share: s.share })),
    date: e.date,
    createdBy: e.createdBy.toString(),
  };
}

export function serializePoll(p, viewerId) {
  return {
    id: p._id.toString(),
    question: p.question,
    closed: p.closed,
    createdBy: p.createdBy.toString(),
    createdAt: p.createdAt,
    options: p.options.map((o) => ({
      text: o.text,
      votes: o.votes.map(String),
    })),
    myVote: p.options.findIndex((o) => o.votes.some((v) => String(v) === String(viewerId))),
  };
}
