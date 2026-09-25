import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket.js";

const SEND_EVERY_MS = 5000; // don't flood the server (or drain the battery)
const AUTO_STOP_MS = 60 * 60 * 1000; // sharing turns itself off after 1 hour

/**
 * Opt-in live location. Uses the browser Geolocation API and sends
 * your position to trip members only. Stops when you leave the page.
 */
export function useLocationSharing(tripId, userId, setLocations) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [stopsAt, setStopsAt] = useState(null);
  const watchId = useRef(null);
  const lastSent = useRef(0);
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    clearTimeout(timer.current);
    setSharing(false);
    setStopsAt(null);
    getSocket().emit("location:stop", { tripId });
    setLocations((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, [tripId, userId, setLocations]);

  const start = useCallback(() => {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location sharing.");
      return;
    }
    lastSent.current = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          ts: Date.now(),
        };
        setLocations((prev) => ({ ...prev, [userId]: { userId, ...loc } })); // show myself immediately
        if (Date.now() - lastSent.current >= SEND_EVERY_MS) {
          lastSent.current = Date.now();
          getSocket().emit("location:update", { tripId, ...loc });
        }
      },
      (err) => {
        setError(err.code === 1 ? "Location permission was denied. Allow it in your browser settings." : "Couldn't get your location.");
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setSharing(true);
    setStopsAt(Date.now() + AUTO_STOP_MS);
    timer.current = setTimeout(stop, AUTO_STOP_MS);
  }, [tripId, userId, setLocations, stop]);

  // Stop sharing when leaving the trip page
  useEffect(() => () => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      getSocket().emit("location:stop", { tripId });
    }
    clearTimeout(timer.current);
  }, [tripId]);

  return { sharing, start, stop, error, stopsAt };
}
