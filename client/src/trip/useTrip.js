import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

/**
 * Loads a trip and keeps it live:
 *  - joins the trip's Socket.io room (and re-joins after reconnecting)
 *  - applies itinerary/member updates from friends instantly
 *  - tracks who is online and friends' live locations
 */
export function useTrip(tripId, userId, { onGone } = {}) {
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");
  const [online, setOnline] = useState([]);
  const [locations, setLocations] = useState({}); // userId -> { lat, lng, accuracy, ts }
  const [connected, setConnected] = useState(true);
  const onGoneRef = useRef(onGone);
  useEffect(() => {
    onGoneRef.current = onGone;
  }, [onGone]);

  const withOwner = useCallback(
    (t) => ({ ...t, isOwner: t.members.some((m) => m.id === userId && m.role === "owner") }),
    [userId]
  );

  const reload = useCallback(() => {
    return api(`/trips/${tripId}`)
      .then((d) => setTrip(withOwner(d.trip)))
      .catch((e) => setError(e.message));
  }, [tripId, withOwner]);

  useEffect(() => {
    setTrip(null);
    setError("");
    reload();
  }, [reload]);

  useEffect(() => {
    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit("trip:join", { tripId }, (res) => {
        if (!res?.ok) return;
        setLocations(Object.fromEntries((res.locations || []).map((l) => [l.userId, l])));
      });
    };
    const onReconnect = () => {
      join();
      reload(); // we may have missed updates while offline
    };
    let firstConnect = true;
    const onConnect = () => {
      if (firstConnect) {
        firstConnect = false;
        join();
      } else onReconnect();
    };
    const onDisconnect = () => setConnected(false);

    const onTrip = (t) => t.id === tripId && setTrip((prev) => ({ ...withOwner(t), places: t.places ?? prev?.places ?? [] }));
    const onPlaces = ({ places }) => setTrip((prev) => (prev ? { ...prev, places } : prev));
    const onPresence = ({ userIds }) => setOnline(userIds);
    const onLocation = (loc) => setLocations((prev) => ({ ...prev, [loc.userId]: loc }));
    const onLocationStop = ({ userId: uid }) =>
      setLocations((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    const onDeleted = (p) => p.tripId === tripId && onGoneRef.current?.("This trip was deleted by its owner.");
    const onRemoved = (p) => p.tripId === tripId && onGoneRef.current?.("You were removed from this trip.");

    if (socket.connected) onConnect();
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("trip:updated", onTrip);
    socket.on("places:updated", onPlaces);
    socket.on("presence", onPresence);
    socket.on("location:update", onLocation);
    socket.on("location:stop", onLocationStop);
    socket.on("trip:deleted", onDeleted);
    socket.on("trip:removed", onRemoved);

    // Drop locations that stopped updating (phone asleep, lost signal...)
    const prune = setInterval(() => {
      const cutoff = Date.now() - 10 * 60 * 1000;
      setLocations((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, l]) => l.ts > cutoff));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 30000);

    return () => {
      socket.emit("trip:leave", { tripId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("trip:updated", onTrip);
      socket.off("places:updated", onPlaces);
      socket.off("presence", onPresence);
      socket.off("location:update", onLocation);
      socket.off("location:stop", onLocationStop);
      socket.off("trip:deleted", onDeleted);
      socket.off("trip:removed", onRemoved);
      clearInterval(prune);
    };
  }, [tripId, reload, withOwner]);

  return { trip, setTrip, error, online, locations, setLocations, connected, reload };
}
