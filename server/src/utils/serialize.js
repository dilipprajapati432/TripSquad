// Turn database documents into clean JSON for the frontend.

export const MEMBER_COLORS = [
  "#0e7490", "#c2410c", "#4338ca", "#15803d", "#b45309", "#be185d",
  "#1d4ed8", "#7e22ce", "#0f766e", "#a16207", "#475467", "#9f1239",
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
    photo: p.photo || "",
  };
}

export function serializeCover(trip) {
  const c = trip.cover;
  if (!c?.url || c.kind === "none") return null;
  return { url: c.url, page: c.page || "", credit: c.credit || "", kind: c.kind || "auto", position: c.position ?? 50 };
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
    theme: trip.theme || 0,
    cover: serializeCover(trip),
    requireContact: Boolean(trip.requireContact),
    inviteCode: trip.inviteCode,
    isOwner,
    members: trip.members.map((m, i) => ({
      id: (m.user._id || m.user).toString(),
      name: m.user.name || "Member",
      avatar: m.user.avatarThumb || "",
      // Only whether they exist, never the numbers themselves
      hasPhone: Boolean(m.user.phone),
      hasEmergency: Boolean(m.user.emergencyName && m.user.emergencyPhone),
      role: m.role,
      budget: m.budget,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    })),
    places: serializePlaces(trip),
  };
}

export function serializeTripSummary(trip, viewerId, extra = {}) {
  return {
    id: trip._id.toString(),
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    theme: trip.theme || 0,
    cover: serializeCover(trip),
    days: trip.dayCount(),
    memberCount: trip.members.length,
    members: trip.members.slice(0, 5).map((m, i) => ({
      id: (m.user._id || m.user).toString(),
      name: m.user.name || "Member",
      avatar: m.user.avatarThumb || "",
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    })),
    totalSpent: extra.totalSpent || 0,
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

export function serializeMessage(m) {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m._id.toString(),
    channel: m.channel,
    kind: m.kind,
    from: m.from ? m.from.toString() : null,
    text: deleted ? "" : m.text,
    place: !deleted && m.place?.lat != null ? { name: m.place.name, lat: m.place.lat, lng: m.place.lng } : null,
    icon: m.icon || null,
    createdAt: m.createdAt,
    editedAt: m.editedAt || null,
    deleted,
    deletedBy: deleted && m.deletedBy ? m.deletedBy.toString() : null,
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
