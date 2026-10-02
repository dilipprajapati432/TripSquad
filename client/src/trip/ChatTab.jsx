import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Ban, Bell, BellOff, Check, Ellipsis, ExternalLink, MapPin, MessageSquare, Paperclip, Pencil, SendHorizontal, Trash2, Users, Hand, LocateFixed } from "lucide-react";
import { api } from "../lib/api.js";
import { ACTIVITY_ICONS, stripLeadingEmoji } from "../lib/icons.jsx";
import { getSocket } from "../lib/socket.js";
import { clockTime, dayLabel } from "../lib/format.js";
import { enableNotifications, disableNotifications, notifyEnabled, notifySupported } from "../lib/notify.js";
import { useUI } from "../context/UIContext.jsx";
import Avatar from "../components/Avatar.jsx";

const mapsLink = (p) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;

function preview(m, members, userId) {
  if (!m) return "No messages yet";
  if (m.kind === "system") return stripLeadingEmoji(m.text);
  if (m.deleted) return "Message deleted";
  const who = m.from === userId ? "You" : members.find((x) => x.id === m.from)?.name.split(" ")[0] || "Someone";
  const body = m.kind === "text" ? m.text : m.kind === "location" ? "Location" : m.place?.name;
  return `${who}: ${body}`;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Automatic trip update in the group chat ("Riya added an expense") */
function SystemMessage({ m }) {
  const Icon = ACTIVITY_ICONS[m.icon] || ACTIVITY_ICONS.info;
  return (
    <div className="msg-system">
      <Icon size={13} />
      <span>{stripLeadingEmoji(m.text)}</span>
    </div>
  );
}

function Bubble({ m, mine, member, showName, showAvatar, onProfile, canDelete, onEdit, onDelete, editing, now }) {
  const [menu, setMenu] = useState(false);
  const canEdit = mine && m.kind === "text" && !m.deleted && now - new Date(m.createdAt) < EDIT_WINDOW_MS;
  const hasActions = !m.deleted && (canEdit || canDelete);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <div
      className={`msg-row ${mine ? "mine" : ""} ${editing ? "msg-editing" : ""}`}
      onContextMenu={(e) => {
        if (!hasActions) return;
        e.preventDefault(); // right-click / long-press opens the menu
        setMenu(true);
      }}
    >
      {!mine && (showAvatar ? <Avatar member={member} size={28} onClick={() => member && onProfile(member.id)} /> : <span className="msg-avatar-space" />)}
      <div className={`bubble ${m.deleted ? "bubble-deleted" : ""}`}>
        {showName && !mine && <div className="bubble-name" style={{ color: member?.color }}>{member?.name || "Former member"}</div>}
        {m.deleted ? (
          <span className="inline-icon"><Ban size={14} /> {m.deletedBy && m.deletedBy !== m.from ? "Removed by the trip owner" : mine ? "You deleted this message" : "This message was deleted"}</span>
        ) : m.kind === "text" ? (
          <span>{m.text}</span>
        ) : (
          <div className="place-card">
            <div className="place-card-map">{m.kind === "location" ? <LocateFixed size={20} /> : <MapPin size={20} />}</div>
            <strong>{m.kind === "location" ? (mine ? "You shared your location" : "Shared their location") : m.place.name}</strong>
            <a href={mapsLink(m.place)} target="_blank" rel="noreferrer" className="small inline-icon">Open in map <ExternalLink size={12} /></a>
          </div>
        )}
        <span className="bubble-time">{m.editedAt && !m.deleted && "edited · "}{clockTime(m.createdAt)}</span>
      </div>
      {hasActions && (
        <div className="msg-actions">
          <button
            type="button"
            className="msg-more"
            aria-label="Message options"
            onClick={(e) => {
              e.stopPropagation();
              setMenu(!menu);
            }}
          >
            <Ellipsis size={16} />
          </button>
          {menu && (
            <div className="msg-menu card" onClick={(e) => e.stopPropagation()}>
              {canEdit && <button type="button" onClick={() => { setMenu(false); onEdit(m); }}><Pencil size={14} /> Edit</button>}
              {canDelete && <button type="button" className="danger" onClick={() => { setMenu(false); onDelete(m); }}><Trash2 size={14} /> Delete for everyone</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Conversation({ trip, userId, channel, withMember, online, onProfile, onBack, onRead }) {
  const { toast } = useUI();
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [reads, setReads] = useState({});
  const [typing, setTyping] = useState({}); // userId -> timestamp
  const [now, setNow] = useState(() => Date.now()); // ticks, so time-based UI updates without Date.now() in render
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [editing, setEditing] = useState(null); // message being edited
  const { confirm } = useUI();
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const keepOffset = useRef(null);
  const memberById = useMemo(() => Object.fromEntries(trip.members.map((m) => [m.id, m])), [trip.members]);

  const early = useRef([]); // live messages that arrived before the history finished loading
  const load = useCallback(async () => {
    const d = await api(`/trips/${trip.id}/chat/${channel}/messages`);
    stickToBottom.current = true;
    // Merge instead of replace: on reconnect we keep older pages already loaded and any
    // message that arrived live while this request was in flight. Fresh copies win (edits/deletes).
    setMessages((cur) => {
      const byId = new Map([...(cur || []), ...early.current, ...d.messages].map((m) => [m.id, m]));
      for (const m of d.messages) byId.set(m.id, m);
      early.current = [];
      return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
    setHasMore((prev) => (prev && d.messages.length ? prev : d.hasMore));
    setReads(d.reads);
    onRead(channel);
  }, [trip.id, channel, onRead]);

  useEffect(() => {
    setMessages(null);
    load().catch((e) => toast(e.message, { type: "error" }));
  }, [load, toast]);

  // Live updates for this conversation
  useEffect(() => {
    const socket = getSocket();
    const onMessage = ({ tripId, message }) => {
      if (tripId !== trip.id || message.channel !== channel) return;
      const el = scrollRef.current;
      stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120 || message.from === userId;
      setMessages((list) => {
        if (!list) {
          early.current.push(message);
          return list;
        }
        return list.some((m) => m.id === message.id) ? list : [...list, message];
      });
      setTyping((t) => ({ ...t, [message.from]: 0 }));
      if (message.from !== userId && document.visibilityState === "visible") onRead(channel);
    };
    const onUpdated = ({ tripId, message }) => {
      if (tripId !== trip.id || message.channel !== channel) return;
      setMessages((list) => list?.map((m) => (m.id === message.id ? message : m)));
    };
    const onReadEvt = ({ tripId, channel: c, userId: u, at }) => {
      if (tripId === trip.id && c === channel) setReads((r) => ({ ...r, [u]: at }));
    };
    const onTyping = ({ tripId, channel: c, userId: u }) => {
      if (tripId === trip.id && c === channel && u !== userId) setTyping((t) => ({ ...t, [u]: Date.now() }));
    };
    const onVisible = () => document.visibilityState === "visible" && onRead(channel);
    socket.on("chat:message", onMessage);
    socket.on("chat:read", onReadEvt);
    socket.on("chat:updated", onUpdated);
    socket.on("chat:typing", onTyping);
    socket.on("connect", load);
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => setNow(Date.now()), 1500); // expires "typing…" and the 15-min edit window
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:read", onReadEvt);
      socket.off("chat:updated", onUpdated);
      socket.off("chat:typing", onTyping);
      socket.off("connect", load);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
    };
  }, [trip.id, channel, userId, onRead, load]);

  // Scroll: stay at the bottom for new messages; keep position when loading older ones
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages) return;
    if (keepOffset.current != null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const [loadingOlder, setLoadingOlder] = useState(false);
  async function loadOlder() {
    if (!messages?.length || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    keepOffset.current = el.scrollHeight - el.scrollTop;
    try {
      const d = await api(`/trips/${trip.id}/chat/${channel}/messages?before=${encodeURIComponent(messages[0].createdAt)}`);
      setMessages((list) => {
        const have = new Set((list || []).map((m) => m.id));
        return [...d.messages.filter((m) => !have.has(m.id)), ...(list || [])];
      });
      setHasMore(d.hasMore);
    } catch (e) {
      keepOffset.current = null;
      toast(e.message, { type: "error" });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(body) {
    setSending(true);
    try {
      const { message } = await api(`/trips/${trip.id}/chat/${channel}/messages`, { method: "POST", body });
      stickToBottom.current = true;
      // The history may still be loading (list is null); the message then arrives with it
      setMessages((list) => (!list || list.some((m) => m.id === message.id) ? list : [...list, message]));
      return true;
    } catch (e) {
      toast(e.message, { type: "error" });
      return false;
    } finally {
      setSending(false);
    }
  }

  function startEdit(m) {
    setEditing(m);
    setText(m.text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  async function saveEdit(value) {
    setSending(true);
    try {
      const { message } = await api(`/trips/${trip.id}/chat/${channel}/messages/${editing.id}`, { method: "PATCH", body: { text: value } });
      setMessages((list) => list?.map((m) => (m.id === message.id ? message : m)));
      cancelEdit();
    } catch (err) {
      toast(err.message, { type: "error" });
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(m) {
    const mine = m.from === userId;
    const ok = await confirm({
      title: "Delete for everyone?",
      message: mine ? "Everyone in this chat will see “This message was deleted” instead." : "You're removing someone else's message as the trip owner. Everyone will see that it was removed.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const { message } = await api(`/trips/${trip.id}/chat/${channel}/messages/${m.id}`, { method: "DELETE" });
      setMessages((list) => list?.map((x) => (x.id === message.id ? message : x)));
      if (editing?.id === m.id) cancelEdit();
    } catch (err) {
      toast(err.message, { type: "error" });
    }
  }

  async function sendText(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    if (editing) return saveEdit(value);
    setText("");
    if (!(await send({ text: value }))) setText(value);
  }

  function shareLocation() {
    setAttachOpen(false);
    if (!navigator.geolocation) return toast("Your browser can't share location.", { type: "error" });
    navigator.geolocation.getCurrentPosition(
      (pos) => send({ kind: "location", place: { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "My location" } }),
      () => toast("Couldn't get your location. Check the browser permission.", { type: "error" }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function sharePlace(p) {
    setAttachOpen(false);
    send({ kind: "place", place: { name: p.name, lat: p.lat, lng: p.lng } });
  }

  const lastTyping = useRef(0);
  const onKeyDown = (e) => {
    if (e.key === "Escape" && editing) return cancelEdit();
    // ↑ in an empty box edits your last message (like Slack)
    if (e.key === "ArrowUp" && !text && lastEditable) {
      e.preventDefault();
      return startEdit(lastEditable);
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendText();
    }
  };
  const onChange = (e) => {
    setText(e.target.value);
    // Tell others "…is typing" at most every 2 seconds
    if (e.target.value && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      getSocket().emit("chat:typing", { tripId: trip.id, channel });
    }
  };

  // "Seen by" under my latest message
  const lastMine = [...(messages || [])].reverse().find((m) => m.from === userId);
  const lastEditable = lastMine && lastMine.kind === "text" && !lastMine.deleted && now - new Date(lastMine.createdAt) < EDIT_WINDOW_MS ? lastMine : null;
  const isOwner = trip.isOwner;
  const seenBy = lastMine
    ? Object.entries(reads)
        .filter(([u, at]) => u !== userId && memberById[u] && new Date(at) >= new Date(lastMine.createdAt))
        .map(([u]) => memberById[u])
    : [];
  const typers = Object.entries(typing)
    .filter(([, ts]) => now - ts < 4000)
    .map(([u]) => memberById[u]?.name.split(" ")[0])
    .filter(Boolean);

  const title = withMember ? withMember.name : `${trip.name} · group`;

  return (
    <div className="chat-main">
      <div className="chat-head">
        <button className="icon-btn show-sm" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={18} /></button>
        {withMember ? (
          <Avatar member={withMember} size={36} online={online.includes(withMember.id)} onClick={() => onProfile(withMember.id)} />
        ) : (
          <span className="channel-group-icon"><Users size={18} /></span>
        )}
        <div style={{ minWidth: 0 }}>
          <strong>{title}</strong>
          <div className="muted small">
            {withMember
              ? online.includes(withMember.id) ? "online now" : "offline · they'll see it later"
              : `${trip.members.length} people · ${trip.members.filter((m) => online.includes(m.id)).length} online`}
          </div>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {!messages && <div className="spinner" />}
        {hasMore && <button className="btn btn-ghost btn-sm load-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Loading…" : "Load older messages"}</button>}
        {messages?.length === 0 && (
          <div className="chat-empty">
            <div className="empty-icon">{withMember ? <Hand size={22} /> : <MessageSquare size={22} />}</div>
            <p>{withMember ? `Say hi to ${withMember.name.split(" ")[0]} — only you two can see this chat.` : "No messages yet. Start the group conversation."}</p>
          </div>
        )}
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          if (m.kind === "system") {
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {newDay && <div className="day-sep">{dayLabel(m.createdAt)}</div>}
                <SystemMessage m={m} />
              </div>
            );
          }
          const sameAsPrev = prev && !newDay && prev.from === m.from && prev.kind !== "system" && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;
          const lastOfGroup = !next || next.from !== m.from || next.kind === "system" || new Date(next.createdAt) - new Date(m.createdAt) >= 5 * 60000;
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {newDay && <div className="day-sep">{dayLabel(m.createdAt)}</div>}
              <Bubble
                m={m}
                mine={m.from === userId}
                member={memberById[m.from]}
                showName={!sameAsPrev && channel === "group"}
                showAvatar={lastOfGroup}
                onProfile={onProfile}
                canDelete={m.from === userId || (channel === "group" && isOwner)}
                onEdit={startEdit}
                onDelete={deleteMessage}
                editing={editing?.id === m.id}
                now={now}
              />
              {m.id === lastMine?.id && seenBy.length > 0 && (
                <div className="seen" title={`Seen by ${seenBy.map((s) => s.name).join(", ")}`}>
                  Seen {channel === "group" && "by"} {seenBy.slice(0, 5).map((s) => <Avatar key={s.id} member={s} size={16} />)}
                  {seenBy.length > 5 && ` +${seenBy.length - 5}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="typing">
        {typers.length > 0 && (
          <>
            <span className="dots"><span /><span /><span /></span>
            {typers.join(", ")} {typers.length > 1 ? "are" : "is"} typing…
          </>
        )}
      </div>

      {editing && (
        <div className="edit-banner">
          <span className="inline-icon"><Pencil size={14} /> Editing message <span className="muted small">· Esc to cancel</span></span>
          <button type="button" className="link-btn" onClick={cancelEdit}>Cancel</button>
        </div>
      )}
      <form className="composer" onSubmit={sendText}>
        <div style={{ position: "relative" }}>
          <button type="button" className="icon-btn composer-attach" onClick={() => setAttachOpen(!attachOpen)} aria-label="Share location or place" title="Share location or a place"><Paperclip size={18} /></button>
          {attachOpen && (
            <div className="attach-menu card">
              <button type="button" onClick={shareLocation}><LocateFixed size={15} /> Share my current location</button>
              {trip.places.slice(0, 8).map((p) => (
                <button type="button" key={p.id} onClick={() => sharePlace(p)}><MapPin size={15} /> {p.name}</button>
              ))}
              {trip.places.length === 0 && <p className="muted small pad">Add places in Plan to share them here.</p>}
            </div>
          )}
        </div>
        <textarea
          rows={1}
          value={text}
          ref={inputRef}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={withMember ? `Message ${withMember.name.split(" ")[0]}…` : "Message the group…"}
          maxLength={2000}
          aria-label="Message"
        />
        <button className="btn btn-primary composer-send" disabled={!text.trim() || sending} aria-label={editing ? "Save edit" : "Send"}>{editing ? <Check size={18} /> : <SendHorizontal size={18} />}</button>
      </form>
    </div>
  );
}

export default function ChatTab({ trip, userId, chat, online, onProfile, startOpen = false }) {
  const { toast } = useUI();
  // On phones the list and the conversation are separate screens
  const [open, setOpen] = useState(() => startOpen || window.innerWidth > 720);
  const [notify, setNotify] = useState(notifyEnabled());
  const memberById = useMemo(() => Object.fromEntries(trip.members.map((m) => [m.id, m])), [trip.members]);
  const { channels, active, setActive, markRead } = chat;
  const activeInfo = channels.find((c) => c.channel === active);
  const withMember = activeInfo?.withUser ? memberById[activeInfo.withUser] : null;

  async function toggleNotify() {
    if (notify) {
      disableNotifications();
      setNotify(false);
      return;
    }
    const ok = await enableNotifications();
    setNotify(ok);
    toast(ok ? "You'll get alerts for new messages when TripSquad is in the background." : "Notifications are blocked in your browser settings.", { type: ok ? "success" : "error" });
  }

  const sorted = [...channels].sort((a, b) => {
    if (a.channel === "group") return -1;
    if (b.channel === "group") return 1;
    return new Date(b.last?.createdAt || 0) - new Date(a.last?.createdAt || 0);
  });

  return (
    <div className={`card chat ${open ? "chat-open" : ""}`}>
      <aside className="chat-list">
        <div className="chat-list-head">
          <h3 style={{ margin: 0 }}>Chats</h3>
          {notifySupported() && (
            <button className="icon-btn" onClick={toggleNotify} title={notify ? "Turn off message alerts" : "Get alerts for new messages"}>
              {notify ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
          )}
        </div>
        {sorted.map((c) => {
          const m = c.withUser ? memberById[c.withUser] : null;
          if (c.withUser && !m) return null;
          return (
            <button
              key={c.channel}
              className={`channel ${active === c.channel ? "channel-active" : ""}`}
              onClick={() => {
                setActive(c.channel);
                setOpen(true);
              }}
            >
              {m ? <Avatar member={m} size={36} online={online.includes(m.id)} /> : <span className="channel-group-icon"><Users size={18} /></span>}
              <div className="channel-main">
                <strong>{m ? m.name : "Whole group"}</strong>
                <span>{preview(c.last, trip.members, userId)}</span>
              </div>
              {c.unread > 0 && <span className="count-badge">{c.unread > 99 ? "99+" : c.unread}</span>}
            </button>
          );
        })}
        {channels.length === 1 && <p className="muted small pad">Invite friends to chat privately with them too.</p>}
      </aside>
      {activeInfo && (
        <Conversation
          key={active}
          trip={trip}
          userId={userId}
          channel={active}
          withMember={withMember}
          online={online}
          onProfile={onProfile}
          onBack={() => setOpen(false)}
          onRead={markRead}
        />
      )}
    </div>
  );
}
