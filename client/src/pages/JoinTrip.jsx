import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateRange } from "../lib/format.js";

export default function JoinTrip() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/trips/invite/${encodeURIComponent(code)}`)
      .then((d) => {
        if (d.invite.alreadyMember) navigate(`/trips/${d.invite.tripId}`, { replace: true });
        else setInvite(d.invite);
      })
      .catch((e) => setError(e.message));
  }, [code, navigate]);

  async function join() {
    setBusy(true);
    try {
      const { trip } = await api(`/trips/join/${encodeURIComponent(code)}`, { method: "POST" });
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <div className="card join-card">
        {error ? (
          <>
            <div className="empty-icon">😕</div>
            <p className="error">{error}</p>
            <Link to="/" className="btn btn-secondary">Back to my trips</Link>
          </>
        ) : !invite ? (
          <div className="spinner" />
        ) : (
          <>
            <p className="muted">You're invited to</p>
            <h1>{invite.name}</h1>
            <p>📍 {invite.destination} · {dateRange(invite.startDate, invite.endDate)}</p>
            <p className="muted small">
              {invite.memberNames.join(", ")}
              {invite.memberCount > invite.memberNames.length && ` and ${invite.memberCount - invite.memberNames.length} more`}
            </p>
            {invite.full ? (
              <p className="error">This trip is full.</p>
            ) : (
              <button className="btn btn-primary btn-block" onClick={join} disabled={busy}>
                {busy ? "Joining…" : "Join trip"}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
