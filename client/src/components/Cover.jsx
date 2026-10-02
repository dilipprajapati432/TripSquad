import { useState } from "react";
import { themeOf } from "../lib/format.js";
import { assetUrl } from "../lib/api.js";

/**
 * Trip cover: the destination photo (from Wikivoyage/Wikipedia) that fades in when loaded.
 * Until then — or if there is no photo — a gradient in the trip's color with a subtle route pattern.
 */
export default function Cover({ cover, theme, className = "", eager = false, children }) {
  const t = themeOf(theme);
  // Remember which URL loaded/failed, so a new photo (destination changed) fades in again
  const [loaded, setLoaded] = useState(null);
  const [failed, setFailed] = useState(null);
  const url = assetUrl(cover?.url);
  return (
    <div className={`cover ${className}`} style={{ "--c1": t.color, "--c2": t.deep }}>
      {url && failed !== url && (
        <img
          src={url}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`cover-img ${loaded === url ? "is-loaded" : ""}`}
          style={{ objectPosition: `50% ${cover.position ?? 50}%` }}
          onLoad={() => setLoaded(url)}
          onError={() => setFailed(url)}
        />
      )}
      {children}
    </div>
  );
}

/** "Photo: Wikivoyage" link — Wikimedia images need attribution. */
export function CoverCredit({ cover }) {
  if (!cover?.url || !cover.credit) return null; // your own uploads need no credit
  return (
    <a className="cover-credit" href={cover.page} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      Photo: {cover.credit}
    </a>
  );
}
