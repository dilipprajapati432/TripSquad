import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { CalendarDays, ChevronLeft, CircleAlert, ImagePlus, LocateFixed, Map as MapIcon, MapPin, MessageSquare, Scale, Settings, ShieldAlert, UserPlus, Users, Vote, Wallet } from "lucide-react";
import { dateRange, money, tripStatus } from "../lib/format.js";
import Cover, { CoverCredit } from "../components/Cover.jsx";
import Avatar from "../components/Avatar.jsx";
import { useTrip } from "../trip/useTrip.js";
import { useLocationSharing } from "../trip/useLocationSharing.js";
import { useChat, dmChannel } from "../trip/useChat.js";
import PlanTab from "../trip/PlanTab.jsx";
import ChatTab from "../trip/ChatTab.jsx";
import MoneyTab from "../trip/MoneyTab.jsx";
import PollsTab from "../trip/PollsTab.jsx";
import PeopleTab from "../trip/PeopleTab.jsx";
import TripSettings from "../trip/TripSettings.jsx";
import ProfileDrawer from "../trip/ProfileDrawer.jsx";
import CoverEditor from "../trip/CoverEditor.jsx";

const TABS = [
  { id: "plan", icon: MapIcon, label: "Plan" },
  { id: "chat", icon: MessageSquare, label: "Chat" },
  { id: "money", icon: Wallet, label: "Money" },
  { id: "polls", icon: Vote, label: "Polls" },
  { id: "people", icon: Users, label: "People" },
];

/** Section tabs with a highlight that slides to the active tab (bottom navigation on phones). */
function Tabs({ tab, unread, onChange }) {
  const navRef = useRef(null);
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector(".tab-active");
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [tab]);
  return (
    <nav className="tabs" aria-label="Trip sections" ref={navRef}>
      {pill && <span className="tab-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} aria-hidden="true" />}
      {TABS.map((t) => (
        <button key={t.id} className={`tab ${tab === t.id ? "tab-active" : ""}`} onClick={() => onChange(t.id)} aria-current={tab === t.id ? "page" : undefined}>
          <t.icon size={18} className="tab-icon" />
          <span>{t.label}</span>
          {t.id === "chat" && unread > 0 && <span className="count-badge">{unread > 99 ? "99+" : unread}</span>}
        </button>
      ))}
    </nav>
  );
}

function TripSkeleton() {
  return (
    <main className="trip">
      <div className="skeleton" style={{ height: 280, marginBottom: 12, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 420 }} />
    </main>
  );
}

export default function TripPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "plan";
  const [meta, setMeta] = useState({ currencies: ["INR"], categories: ["other"], aiEnabled: false, maxMembers: 30 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [weather, setWeather] = useState(null);
  const [chatStartOpen, setChatStartOpen] = useState(false);

  const onGone = useCallback(
    (message) => {
      toast(message, { icon: "leave", duration: 6000 });
      navigate("/", { replace: true });
    },
    [toast, navigate]
  );
  const { trip, setTrip, error, online, locations, setLocations, connected, reload } = useTrip(tripId, user.id, { onGone });
  const loc = useLocationSharing(tripId, user.id, setLocations);

  // "Riya started sharing her location" — shown on any tab
  const liveIds = useRef(null);
  const liveKey = Object.keys(locations).sort().join(",");
  useEffect(() => {
    const ids = liveKey ? liveKey.split(",") : [];
    if (liveIds.current && trip) {
      for (const id of ids) {
        if (id !== user.id && !liveIds.current.includes(id)) {
          const name = trip.members.find((m) => m.id === id)?.name.split(" ")[0] || "Someone";
          toast(`${name} is sharing live location — see them on the Plan map`, { icon: "location" });
        }
      }
    }
    liveIds.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  const goTab = useCallback((id) => setParams(id === "plan" ? {} : { tab: id }, { replace: true }), [setParams]);
  const chat = useChat(trip, user.id, {
    chatOpen: tab === "chat",
    onOpenChannel: (channel) => {
      chat.setActive(channel);
      goTab("chat");
    },
  });

  const openChatWith = (otherId) => {
    chat.setActive(dmChannel(user.id, otherId));
    setChatStartOpen(true);
    setProfileId(null);
    goTab("chat");
  };

  useEffect(() => {
    api("/util/meta").then(setMeta).catch(() => {});
  }, []);

  // Quick stats in the header (group spend + my balance), kept live
  const loadSummary = useCallback(() => {
    api(`/trips/${tripId}/expenses/summary`).then(setSummary).catch(() => {});
  }, [tripId]);
  useEffect(() => {
    loadSummary();
    const socket = getSocket();
    socket.on("expenses:updated", loadSummary);
    socket.on("connect", loadSummary); // missed updates while offline
    return () => {
      socket.off("expenses:updated", loadSummary);
      socket.off("connect", loadSummary);
    };
  }, [loadSummary]);

  // Toasts when friends do things; refresh members when someone changes name/photo
  useEffect(() => {
    const socket = getSocket();
    const onActivity = (a) => a.by !== user.id && toast(a.text, { icon: a.icon });
    const onMembers = () => reload();
    const onCover = ({ tripId: t, cover }) => t === tripId && setTrip((prev) => prev && { ...prev, cover });
    socket.on("trip:cover", onCover);
    socket.on("activity", onActivity);
    socket.on("members:changed", onMembers);
    return () => {
      socket.off("trip:cover", onCover);
      socket.off("activity", onActivity);
      socket.off("members:changed", onMembers);
    };
  }, [toast, user.id, reload, tripId, setTrip]);

  // Weather for the trip days (re-fetched if dates or destination change)
  const weatherKey = trip ? `${trip.id}|${trip.startDate}|${trip.endDate}|${trip.center?.lat}` : "";
  useEffect(() => {
    if (!weatherKey) return;
    api(`/trips/${tripId}/weather`).then(setWeather).catch(() => setWeather(null));
  }, [weatherKey, tripId]);

  if (error) {
    return (
      <main className="page narrow">
        <div className="card center stack">
          <div className="empty-icon"><CircleAlert size={22} /></div>
          <p className="error">{error}</p>
          <Link to="/" className="btn btn-secondary">Back to my trips</Link>
        </div>
      </main>
    );
  }
  if (!trip) return <TripSkeleton />;

  const status = tripStatus(trip.startDate, trip.endDate);
  const myBalance = summary?.balances?.[user.id] ?? 0;
  const scheduled = trip.places.filter((p) => p.day > 0).length;

  return (
    <main className={`trip ${tab === "plan" ? "trip-fill" : ""}`}>
      <section className="trip-header card">
        <Cover cover={trip.cover} theme={trip.theme} className="trip-hero" eager>
          <div className="trip-hero-shade" />
          <div className="trip-hero-top">
            <Link to="/" className="glass-btn"><ChevronLeft size={16} /> <span className="hide-sm">All trips</span></Link>
            <div className="trip-header-actions">
              <button className={`glass-btn ${loc.sharing ? "glass-live" : ""}`} onClick={loc.sharing ? loc.stop : loc.start}>
                {loc.status === "locating" ? <><LocateFixed size={16} /> Finding you…</> : loc.sharing ? <><span className="live-dot" /> Sharing · Stop</> : <><LocateFixed size={16} /> Share location</>}
              </button>
              <button className="glass-btn" onClick={() => goTab("people")}><UserPlus size={16} /> <span className="hide-sm">Invite</span></button>
              {trip.isOwner && (
                <button className="glass-btn" onClick={() => setCoverOpen(true)} title="Change the cover photo">
                  <ImagePlus size={16} /> <span className="hide-sm">{trip.cover ? "Cover" : "Add cover"}</span>
                </button>
              )}
              {trip.isOwner && (
                <button className="glass-btn glass-icon" onClick={() => setSettingsOpen(true)} title="Trip settings" aria-label="Trip settings"><Settings size={17} /></button>
              )}
            </div>
          </div>
          <div className="trip-hero-bottom">
            <div className="trip-hero-title">
              <span className={`status-chip status-${status.state} status-on-photo`}>{status.label}</span>
              <h1>{trip.name}</h1>
              <div className="trip-meta trip-meta-light">
                <span className="inline-icon"><MapPin size={15} /> {trip.destination}</span>
                <span className="inline-icon"><CalendarDays size={15} /> {dateRange(trip.startDate, trip.endDate)}</span>
              </div>
            </div>
            <div className="avatars avatars-on-photo" title="Tap someone to see their profile">
              {trip.members.slice(0, 6).map((m) => (
                <Avatar key={m.id} member={m} size={36} online={online.includes(m.id)} onClick={() => setProfileId(m.id)} />
              ))}
              {trip.members.length > 6 && <span className="avatar avatar-more" style={{ width: 36, height: 36 }}>+{trip.members.length - 6}</span>}
            </div>
          </div>
          <CoverCredit cover={trip.cover} />
        </Cover>
        <dl className="trip-stats">
          <div><span className="stat-icon tint-blue"><CalendarDays size={16} /></span><span><dt>Duration</dt><dd>{trip.days} {trip.days === 1 ? "day" : "days"}</dd></span></div>
          <div><span className="stat-icon tint-teal"><MapPin size={16} /></span><span><dt>Planned</dt><dd>{scheduled} of {trip.places.length} places</dd></span></div>
          <div><span className="stat-icon tint-amber"><Wallet size={16} /></span><span><dt>Group spend</dt><dd>{summary ? money(summary.totalSpent, trip.currency) : "–"}</dd></span></div>
          <div>
            <span className={`stat-icon ${myBalance < 0 ? "tint-red" : "tint-green"}`}><Scale size={16} /></span>
            <span>
              <dt>{myBalance > 0 ? "You get back" : myBalance < 0 ? "You owe" : "Your balance"}</dt>
              <dd>
                <button className={`stat-link ${myBalance > 0 ? "pos" : myBalance < 0 ? "neg" : ""}`} onClick={() => goTab("money")}>
                  {summary ? (myBalance === 0 ? "All settled" : money(Math.abs(myBalance), trip.currency)) : "–"}
                </button>
              </dd>
            </span>
          </div>
        </dl>
      </section>

      {loc.error && <p className="error">{loc.error}</p>}
      {loc.sharing && <p className="live-note"><LocateFixed size={14} /> Your live location is visible only to people in this trip while this page is open. It turns off after 1 hour.</p>}
      {trip.requireContact && trip.members.some((m) => m.id === user.id && (!m.hasPhone || !m.hasEmergency)) && (
        <div className="offline-bar">
          <ShieldAlert size={15} /> <span>This trip asks everyone for a phone number and an emergency contact. <Link to="/profile">Add yours now</Link>.</span>
        </div>
      )}
      {!connected && <div className="offline-bar">Reconnecting… changes from friends will appear when you're back online.</div>}

      <Tabs tab={tab} unread={chat.unreadTotal} onChange={(id) => { setChatStartOpen(false); goTab(id); }} />

      <div className="tab-body" key={tab}>
        {tab === "plan" && <PlanTab trip={trip} setTrip={setTrip} locations={locations} aiEnabled={meta.aiEnabled} weather={weather} onProfile={setProfileId} userId={user.id} share={loc} onMessage={openChatWith} />}
        {tab === "chat" && <ChatTab trip={trip} userId={user.id} chat={chat} online={online} onProfile={setProfileId} startOpen={chatStartOpen} />}
        {tab === "money" && <MoneyTab trip={trip} userId={user.id} meta={meta} onProfile={setProfileId} />}
        {tab === "polls" && <PollsTab trip={trip} userId={user.id} />}
        {tab === "people" && <PeopleTab trip={trip} userId={user.id} online={online} meta={meta} onProfile={setProfileId} onMessage={openChatWith} />}
      </div>

      {settingsOpen && (
        <TripSettings trip={{ ...trip, hasExpenses: trip.hasExpenses || (summary?.totalSpent ?? 0) > 0 }} currencies={meta.currencies} onClose={() => setSettingsOpen(false)} onSaved={(t) => setTrip((prev) => ({ ...prev, ...t }))} />
      )}
      {coverOpen && <CoverEditor trip={trip} onClose={() => setCoverOpen(false)} onChange={(cover) => setTrip((prev) => ({ ...prev, cover }))} />}
      {profileId && (
        <ProfileDrawer userId={profileId} trip={trip} me={user.id} online={online} onClose={() => setProfileId(null)} onMessage={openChatWith} />
      )}
    </main>
  );
}
