import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { ChevronDown, FileText, LogOut, Luggage, ShieldCheck, UserRound } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle.jsx";
import ScrollManager from "./components/ScrollManager.jsx";
import Avatar from "./components/Avatar.jsx";

import AuthPage from "./pages/AuthPage.jsx";
import Landing from "./pages/Landing.jsx";
// Loaded with the first page (small), so the header never disappears while they load
import { PrivacyPage, TermsPage } from "./pages/Legal.jsx";
// Pages load on demand, so the login page doesn't download the map, drag & drop, etc.
const loaders = {
  dashboard: () => import("./pages/Dashboard.jsx"),
  join: () => import("./pages/JoinTrip.jsx"),
  trip: () => import("./pages/TripPage.jsx"),
  profile: () => import("./pages/ProfilePage.jsx"),
  welcome: () => import("./pages/Welcome.jsx"),
};
const Dashboard = lazy(loaders.dashboard);
const JoinTrip = lazy(loaders.join);
const TripPage = lazy(loaders.trip);
const ProfilePage = lazy(loaders.profile);
const Welcome = lazy(loaders.welcome);

/** Spinner that only appears if loading takes longer than a moment, so fast page changes don't flash. */
function PageFallback() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);
  return <div className="center-screen">{show && <div className="spinner" />}</div>;
}
const pageFallback = <PageFallback />;

/** "/" is the landing page for visitors and the trip dashboard once you're logged in. */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return pageFallback;
  return user ? <Dashboard /> : <Landing />;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="menu" ref={ref}>
      <button className="menu-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar member={{ ...user, avatar: user.avatarThumb, color: "#0f766e" }} size={32} />
        <span className="hide-sm">{user.name.split(" ")[0]}</span>
        <ChevronDown size={14} className="muted" />
      </button>
      {open && (
        <div className="menu-list card" role="menu">
          <div className="menu-head">
            <strong>{user.name}</strong>
            <div className="muted small">{user.email}</div>
          </div>
          <button onClick={() => { setOpen(false); navigate("/"); }}><Luggage size={16} /> My trips</button>
          <button onClick={() => { setOpen(false); navigate("/profile"); }}><UserRound size={16} /> My profile</button>
          <button onClick={() => { setOpen(false); navigate("/privacy"); }}><ShieldCheck size={16} /> Privacy policy</button>
          <button onClick={() => { setOpen(false); navigate("/terms"); }}><FileText size={16} /> Terms of use</button>
          <button onClick={() => { setOpen(false); logout(); }}><LogOut size={16} /> Log out</button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // On the log-in and sign-up pages the header lines up with the page content, like the landing page
  const aligned = pathname === "/login" || pathname === "/register";
  return (
    <header className={`topbar ${aligned ? "topbar-aligned" : ""}`}>
      <Link to="/" className="brand">
        <img src="/wordmark.png" alt="TripSquad" height="32" style={{ display: "block", width: "auto" }} />
      </Link>
      <div className="topbar-right">
        <ThemeToggle />
        {user && <UserMenu />}
      </div>
    </header>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Public pages bring their own header (with Log in / Get started)
  // Logged-in users keep the app header everywhere, so it doesn't jump when they open Privacy or Terms.
  const publicPage = !user && !loading && ["/", "/privacy", "/terms"].includes(location.pathname);
  // Once logged in, download the other pages in the background so opening them is instant
  useEffect(() => {
    if (!user) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => Object.values(loaders).forEach((load) => load().catch(() => {})));
  }, [user]);

  useEffect(() => {
    if (!publicPage) document.title = "TripSquad — group trip planner";
  }, [publicPage, location.pathname]);
  // After login/sign-up, go back to where the user was heading (e.g. an invite link)
  // New accounts first go through the short setup wizard, then continue to where they were heading.
  const afterAuth =
    user && !user.onboardedAt ? (
      <Navigate to="/welcome" replace state={{ from: location.state?.from || "/" }} />
    ) : (
      <Navigate to={location.state?.from || "/"} replace />
    );
  return (
    <>
      <ScrollManager />
      {!publicPage && <Header />}
      <Suspense fallback={pageFallback}>
      {/* Keyed by page (not by ?tab=), so each new page fades in */}
      <div className="route-view" key={location.pathname}>
      <Routes>
        <Route path="/login" element={user ? afterAuth : <AuthPage mode="login" />} />
        <Route path="/register" element={user ? afterAuth : <AuthPage mode="register" />} />
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
        <Route path="/join/:code" element={<RequireAuth><JoinTrip /></RequireAuth>} />
        <Route path="/trips/:tripId" element={<RequireAuth><TripPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      </Suspense>
    </>
  );
}
