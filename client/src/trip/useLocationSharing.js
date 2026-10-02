import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket.js";

const SEND_EVERY_MS = 5000; // don't flood the server (or drain the battery)
const HEARTBEAT_MS = 30000; // re-send even if you're standing still, so friends know you're still live
const AUTO_STOP_MS = 60 * 60 * 1000; // sharing turns itself off after 1 hour

const ERRORS = {
  1: "Location permission was denied. Click the lock / location icon in the address bar and allow location for this site.",
  2: "Your device couldn't find its location. On Windows: Settings → Privacy & security → Location → turn on Location services. On phones, turn on GPS.",
  3: "Finding your location took too long. Try again near a window or with Wi-Fi on.",
};

/**
 * Opt-in live location. Uses the browser Geolocation API and sends
 * your position to trip members only. Stops when you leave the page.
 * status: "off" | "locating" (waiting for the first fix) | "live"
 */
export function useLocationSharing(tripId, userId, setLocations) {
  const [status, setStatus] = useState("off");
  const [error, setError] = useState("");
  const [stopsAt, setStopsAt] = useState(null);
  const watchId = useRef(null);
  const lastSent = useRef(0);
  const lastLoc = useRef(null);
  const timers = useRef({});

  const send = useCallback(
    (loc) => {
      lastSent.current = Date.now();
      getSocket().emit("location:update", { tripId, ...loc });
    },
    [tripId]
  );

  const clearAll = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    clearTimeout(timers.current.stop);
    clearInterval(timers.current.beat);
  };

  const stop = useCallback(() => {
    clearAll();
    lastLoc.current = null;
    setStatus("off");
    setStopsAt(null);
    getSocket().emit("location:stop", { tripId });
    setLocations((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, [tripId, userId, setLocations]);

  const retryRef = useRef(null); // lets the error handler restart watch() without referencing itself
  const watch = useCallback(
    (highAccuracy) => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            ts: Date.now(),
          };
          const first = !lastLoc.current;
          lastLoc.current = loc;
          setStatus("live");
          setError("");
          setLocations((prev) => ({ ...prev, [userId]: { userId, ...loc } })); // show myself immediately
          if (first || Date.now() - lastSent.current >= SEND_EVERY_MS) send(loc);
        },
        (err) => {
          // Laptops without GPS often time out in high-accuracy mode: retry with Wi-Fi/IP location
          if (err.code === 3 && highAccuracy) return retryRef.current?.(false);
          if (err.code === 3 && lastLoc.current) return; // we already have a position; keep waiting
          setError(ERRORS[err.code] || "Couldn't get your location.");
          stop();
        },
        { enableHighAccuracy: highAccuracy, maximumAge: 10000, timeout: highAccuracy ? 12000 : 30000 }
      );
    },
    [send, setLocations, stop, userId]
  );
  useEffect(() => {
    retryRef.current = watch;
  }, [watch]);

  const start = useCallback(() => {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location sharing.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Browsers only allow location on https:// or localhost. Deploy the app (or use a tunnel) to share from a phone.");
      return;
    }
    lastSent.current = 0;
    lastLoc.current = null;
    setStatus("locating");
    watch(true);
    setStopsAt(Date.now() + AUTO_STOP_MS);
    timers.current.stop = setTimeout(stop, AUTO_STOP_MS);
    timers.current.beat = setInterval(() => {
      if (lastLoc.current) send({ ...lastLoc.current, ts: Date.now() });
    }, HEARTBEAT_MS);
  }, [watch, send, stop]);

  // Stop sharing when leaving the trip page
  useEffect(
    () => () => {
      if (watchId.current != null) getSocket().emit("location:stop", { tripId });
      clearAll();
      // Opening another trip must not show "Sharing" when nothing is being sent
      setStatus("off");
      setStopsAt(null);
      lastLoc.current = null;
    },
    [tripId]
  );

  return { sharing: status !== "off", status, start, stop, error, stopsAt };
}
