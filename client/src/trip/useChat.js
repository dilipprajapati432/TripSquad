import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { showNotification } from "../lib/notify.js";

export const dmChannel = (a, b) => `dm:${[a, b].sort().join("_")}`;

/**
 * Chat state that lives on the trip page (not only in the Chat tab), so we can
 * show unread badges and notifications while you're looking at the map.
 */
export function useChat(trip, userId, { chatOpen, onOpenChannel }) {
  const tripId = trip?.id;
  const [channels, setChannels] = useState([]);
  const [active, setActive] = useState("group");
  const state = useRef({ chatOpen, active, members: [] });
  const openRef = useRef(onOpenChannel);
  useEffect(() => {
    state.current = { chatOpen, active, members: trip?.members || [] };
    openRef.current = onOpenChannel;
  });

  const load = useCallback(() => {
    if (!tripId) return;
    api(`/trips/${tripId}/chat/channels`)
      .then((d) => setChannels(d.channels))
      .catch(() => {});
  }, [tripId]);

  // Reload the channel list when people join or leave
  const memberKey = trip?.members.map((m) => m.id).join(",");
  useEffect(() => {
    load();
  }, [load, memberKey]);

  const markRead = useCallback(
    (channel) => {
      setChannels((list) => list.map((c) => (c.channel === channel ? { ...c, unread: 0 } : c)));
      api(`/trips/${tripId}/chat/${channel}/read`, { method: "POST" }).catch(() => {});
    },
    [tripId]
  );

  useEffect(() => {
    if (!tripId) return;
    const socket = getSocket();
    const onMessage = ({ tripId: t, message }) => {
      if (t !== tripId) return;
      const { chatOpen: open, active: current, members } = state.current;
      const mine = message.from === userId;
      const viewing = open && current === message.channel && document.visibilityState === "visible";
      setChannels((list) => {
        const exists = list.some((c) => c.channel === message.channel);
        if (!exists) return list; // new DM partner: the list reloads on member change
        return list.map((c) =>
          c.channel === message.channel
            ? { ...c, last: message, unread: mine || viewing || message.kind === "system" ? c.unread : c.unread + 1 }
            : c
        );
      });
      if (!mine && message.kind !== "system") {
        const sender = members.find((m) => m.id === message.from)?.name || "Someone";
        const where = message.channel === "group" ? `${sender} in ${trip.name}` : `${sender} (private)`;
        const body = message.kind === "text" ? message.text : message.kind === "location" ? "Shared a location" : `Shared ${message.place?.name}`;
        showNotification(where, body, () => openRef.current?.(message.channel));
      }
    };
    const onUpdated = ({ tripId: t, message }) => {
      if (t !== tripId) return;
      setChannels((list) => list.map((c) => (c.last?.id === message.id ? { ...c, last: message } : c)));
    };
    socket.on("chat:message", onMessage);
    socket.on("chat:updated", onUpdated);
    socket.on("connect", load);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:updated", onUpdated);
      socket.off("connect", load);
    };
  }, [tripId, userId, load, trip?.name]);

  const unreadTotal = channels.reduce((n, c) => n + (c.unread || 0), 0);
  return { channels, active, setActive, markRead, unreadTotal, reload: load };
}
