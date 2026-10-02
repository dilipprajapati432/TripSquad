import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * "← Back" that returns to the page you came from inside TripSquad.
 * If the page was opened directly (a shared link, a new tab), there is nothing to go back to,
 * so it links to `fallback` instead, labelled `fallbackLabel`.
 */
export default function BackLink({ fallback = "/", fallbackLabel = "Home", className = "back" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasHistory = location.key !== "default";
  if (hasHistory) {
    return (
      <button type="button" className={`${className} back-btn`} onClick={() => navigate(-1)}>
        <ChevronLeft size={16} /> Back
      </button>
    );
  }
  return (
    <Link to={fallback} className={className}>
      <ChevronLeft size={16} /> {fallbackLabel}
    </Link>
  );
}
