import { useEffect, useRef, useState } from "react";
import { Check, ImageOff, MoveVertical, RotateCcw, Upload } from "lucide-react";
import { api, uploadFile } from "../lib/api.js";
import { makeCover } from "../lib/image.js";
import { useUI } from "../context/UIContext.jsx";
import Modal from "../components/Modal.jsx";
import Cover from "../components/Cover.jsx";

const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Owner-only: change the trip cover. Upload your own photo, pick one of the suggested
 * destination photos, go back to the automatic one or remove it — and drag to choose
 * which part of the photo shows in the banner.
 */
export default function CoverEditor({ trip, onClose, onChange }) {
  const { toast } = useUI();
  const [cover, setCover] = useState(trip.cover);
  const [position, setPosition] = useState(trip.cover?.position ?? 50);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestError, setSuggestError] = useState("");
  const [busy, setBusy] = useState(""); // what's running: "upload" | "pick:<url>" | "auto" | "none" | "position"
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    api(`/trips/${trip.id}/cover/suggestions`)
      .then((d) => setSuggestions(d.photos))
      .catch((e) => {
        setSuggestions([]);
        setSuggestError(e.message);
      });
  }, [trip.id]);

  const applied = (next) => {
    setCover(next);
    setPosition(next?.position ?? 50);
    onChange(next);
  };

  async function run(what, fn) {
    setBusy(what);
    setError("");
    try {
      applied((await fn()).cover);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run("upload", async () => {
      const blob = await makeCover(file);
      const res = await uploadFile(`/trips/${trip.id}/cover/image`, blob);
      toast("New cover uploaded — everyone in the trip sees it now", { icon: "cover", type: "success" });
      return res;
    });
  }

  const pick = (p) => run(`pick:${p.url}`, () => api(`/trips/${trip.id}/cover`, { method: "PUT", body: { type: "pick", url: p.url } }));
  const auto = () => run("auto", () => api(`/trips/${trip.id}/cover`, { method: "PUT", body: { type: "auto" } }));
  const remove = () => run("none", () => api(`/trips/${trip.id}/cover`, { method: "PUT", body: { type: "none" } }));
  const savePosition = () => run("position", () => api(`/trips/${trip.id}/cover/position`, { method: "PATCH", body: { position } }));

  // Drag the photo up/down to choose what shows in the banner
  const hasPhoto = Boolean(cover?.url);
  const onPointerDown = (e) => {
    if (!hasPhoto || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, start: position, h: e.currentTarget.clientHeight };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const { y, start, h } = drag.current;
    setPosition(clamp(start - ((e.clientY - y) / h) * 120)); // drag down = show more of the top
  };
  const onPointerUp = () => (drag.current = null);
  const onKeyDown = (e) => {
    if (!hasPhoto) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault(); // don't scroll the dialog
    setPosition((p) => clamp(p + (e.key === "ArrowUp" ? -5 : 5)));
  };
  const moved = hasPhoto && position !== (cover.position ?? 50);

  return (
    <Modal title="Trip cover" onClose={onClose} wide>
      <div className="stack">
        <div
          className={`cover-editor ${hasPhoto ? "can-drag" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          tabIndex={hasPhoto ? 0 : -1}
          role={hasPhoto ? "slider" : undefined}
          aria-label="Photo position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={position}
        >
          <Cover cover={cover && { ...cover, position }} theme={trip.theme} className="cover-editor-preview" eager>
            <div className="trip-hero-shade" />
            <div className="cover-editor-title">
              <strong>{trip.name}</strong>
              <span>{trip.destination}</span>
            </div>
            {hasPhoto && <span className="cover-editor-hint"><MoveVertical size={14} /> Drag to reposition</span>}
            {busy === "upload" && <div className="cover-editor-busy"><span className="spinner-sm" /> Uploading…</div>}
          </Cover>
        </div>

        {moved && (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPosition(cover.position ?? 50)} disabled={!!busy}>Undo</button>
            <button className="btn btn-primary btn-sm" onClick={savePosition} disabled={!!busy}>{busy === "position" ? "Saving…" : "Save position"}</button>
          </div>
        )}

        <div className="cover-actions">
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <Upload size={16} /> Upload a photo
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
          {cover?.kind !== "auto" && (
            <button className="btn btn-secondary" onClick={auto} disabled={!!busy}>
              <RotateCcw size={16} /> {busy === "auto" ? "Finding a photo…" : "Use automatic photo"}
            </button>
          )}
          {hasPhoto && (
            <button className="btn btn-ghost" onClick={remove} disabled={!!busy}>
              <ImageOff size={16} /> Remove photo
            </button>
          )}
        </div>
        <p className="hint" style={{ margin: "-0.4rem 0 0" }}>JPEG, PNG or WebP. Large photos are resized automatically. Only you (the trip owner) can change the cover.</p>
        {error && <p className="error">{error}</p>}

        <section className="stack-sm">
          <span className="field-label">Photos of {trip.destination}</span>
          {!suggestions ? (
            <div className="suggest-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton suggest-skeleton" />)}</div>
          ) : suggestions.length === 0 ? (
            <p className="muted small">{suggestError || `We couldn't find photos of ${trip.destination}. Upload your own above.`}</p>
          ) : (
            <div className="suggest-grid">
              {suggestions.map((p) => {
                const current = cover?.url === p.url;
                return (
                  <button
                    key={p.url}
                    type="button"
                    className={`suggest ${current ? "is-current" : ""}`}
                    onClick={() => !current && pick(p)}
                    disabled={!!busy}
                    title={`${p.title} · ${p.credit}`}
                    aria-pressed={current}
                  >
                    <img src={p.url.replace(/\/\d+px-/, "/400px-")} alt={p.title} loading="lazy" />
                    {current && <span className="suggest-check"><Check size={14} strokeWidth={3} /></span>}
                    {busy === `pick:${p.url}` && <span className="suggest-busy"><span className="spinner-sm" /></span>}
                  </button>
                );
              })}
            </div>
          )}
          <span className="hint">Suggested photos come from Wikivoyage and Wikipedia and are credited on the cover.</span>
        </section>
      </div>
    </Modal>
  );
}
