import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import JoinTrip from "./pages/JoinTrip.jsx";
import TripPage from "./pages/TripPage.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-pin">📍</span> TripSquad
      </Link>
      {user && (
        <div className="topbar-right">
          <span className="muted hide-sm">Hi, {user.name.split(" ")[0]}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
      )}
    </header>
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  // After login/sign-up, go back to where the user was heading (e.g. an invite link)
  const afterAuth = <Navigate to={location.state?.from || "/"} replace />;
  return (
    <>
      <Header />
      <Routes>
        <Route path="/login" element={user ? afterAuth : <AuthPage mode="login" />} />
        <Route path="/register" element={user ? afterAuth : <AuthPage mode="register" />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/join/:code" element={<RequireAuth><JoinTrip /></RequireAuth>} />
        <Route path="/trips/:tripId" element={<RequireAuth><TripPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
