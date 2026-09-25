import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import Avatar from "../components/Avatar.jsx";

function NewPoll({ tripId, onDone }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/trips/${tripId}/polls`, { method: "POST", body: { question, options: options.filter((o) => o.trim()) } });
      setQuestion("");
      setOptions(["", ""]);
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h3>New poll</h3>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Scuba diving or boat party?" required maxLength={150} />
      {options.map((o, i) => (
        <div key={i} className="row">
          <input
            value={o}
            onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Option ${i + 1}`}
            maxLength={80}
          />
          {options.length > 2 && (
            <button type="button" className="icon-btn" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove option">✕</button>
          )}
        </div>
      ))}
      <div className="row">
        {options.length < 8 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOptions([...options, ""])}>+ Add option</button>}
        <button className="btn btn-primary btn-sm push">Create poll</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export default function PollsTab({ trip, userId }) {
  const [polls, setPolls] = useState(null);
  const [error, setError] = useState("");
  const memberById = useMemo(() => Object.fromEntries(trip.members.map((m) => [m.id, m])), [trip.members]);

  useEffect(() => {
    const load = () => api(`/trips/${trip.id}/polls`).then((d) => setPolls(d.polls)).catch((e) => setError(e.message));
    load();
    const socket = getSocket();
    // Live updates: a friend created a poll or voted
    const onUpdated = ({ poll }) =>
      setPolls((prev) => {
        if (!prev) return prev;
        const exists = prev.some((p) => p.id === poll.id);
        return exists ? prev.map((p) => (p.id === poll.id ? poll : p)) : [poll, ...prev];
      });
    const onDeleted = ({ pollId }) => setPolls((prev) => prev?.filter((p) => p.id !== pollId));
    socket.on("polls:updated", onUpdated);
    socket.on("polls:deleted", onDeleted);
    socket.on("connect", load);
    return () => {
      socket.off("polls:updated", onUpdated);
      socket.off("polls:deleted", onDeleted);
      socket.off("connect", load);
    };
  }, [trip.id]);

  async function act(path, method = "POST", body) {
    setError("");
    try {
      const d = await api(`/trips/${trip.id}/polls${path}`, { method, body });
      if (d.poll) setPolls((prev) => prev.map((p) => (p.id === d.poll.id ? d.poll : p)));
      if (method === "DELETE") setPolls((prev) => prev.filter((p) => !path.endsWith(p.id)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="polls">
      <NewPoll tripId={trip.id} onDone={() => {}} />
      {error && <p className="error">{error}</p>}
      {!polls ? (
        <div className="spinner" />
      ) : polls.length === 0 ? (
        <p className="muted center">No polls yet. Ask the group something!</p>
      ) : (
        polls.map((poll) => {
          const total = poll.options.reduce((n, o) => n + o.votes.length, 0);
          const myVote = poll.options.findIndex((o) => o.votes.includes(userId));
          const max = Math.max(...poll.options.map((o) => o.votes.length));
          const canManage = poll.createdBy === userId || trip.isOwner;
          return (
            <div key={poll.id} className="card poll">
              <div className="section-head">
                <h3>{poll.question}</h3>
                {poll.closed && <span className="badge">Closed</span>}
              </div>
              <p className="muted small">
                by {memberById[poll.createdBy]?.name || "someone"} · {total} of {trip.members.length} voted
              </p>
              {poll.options.map((o, i) => {
                const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
                const winner = poll.closed && o.votes.length === max && max > 0;
                return (
                  <button
                    key={i}
                    className={`poll-option ${myVote === i ? "poll-mine" : ""} ${winner ? "poll-winner" : ""}`}
                    disabled={poll.closed}
                    onClick={() => act(`/${poll.id}/vote`, "POST", { option: i })}
                  >
                    <span className="poll-fill" style={{ width: `${pct}%` }} />
                    <span className="poll-text">{winner && "🏆 "}{o.text}{myVote === i && " ✓"}</span>
                    <span className="poll-voters">
                      {o.votes.slice(0, 5).map((v) => <Avatar key={v} member={memberById[v]} size={20} />)}
                    </span>
                    <span className="poll-pct">{pct}%</span>
                  </button>
                );
              })}
              {canManage && (
                <div className="row">
                  {!poll.closed && <button className="link-btn" onClick={() => act(`/${poll.id}/close`)}>Close poll</button>}
                  <button className="link-btn danger" onClick={() => confirm("Delete this poll?") && act(`/${poll.id}`, "DELETE")}>Delete</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
