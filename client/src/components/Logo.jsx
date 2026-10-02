// Brand mark: map pin with orbit ring — the primary TripSquad logo.
// Drawn as SVG so it stays crisp at every size with no extra network request.
export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="logo-mark">
      {/* Teal rounded-square background */}
      <rect width="100" height="100" rx="22" fill="url(#tealGrad)" />

      <defs>
        <linearGradient id="tealGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a9e8f" />
          <stop offset="100%" stopColor="#0d7a6e" />
        </linearGradient>
        {/* Clip the orbit ellipse so the front arc appears in front of the pin */}
        <clipPath id="frontArc">
          <rect x="0" y="54" width="100" height="46" />
        </clipPath>
        <clipPath id="backArc">
          <rect x="0" y="0" width="100" height="54" />
        </clipPath>
      </defs>

      {/* Back half of orbit ring (behind pin) */}
      <ellipse cx="50" cy="62" rx="33" ry="9" fill="none"
        stroke="rgba(255,255,255,0.45)" strokeWidth="2.8"
        clipPath="url(#backArc)" />

      {/* Map-pin — white teardrop */}
      <path
        d="M50 18 C39 18 31 26 31 36 C31 49 50 66 50 66 C50 66 69 49 69 36 C69 26 61 18 50 18 Z"
        fill="#ffffff"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
      />
      {/* Orange dot inside pin */}
      <circle cx="50" cy="36" r="9" fill="#E8603C" />

      {/* Front half of orbit ring (in front of pin) */}
      <ellipse cx="50" cy="62" rx="33" ry="9" fill="none"
        stroke="#ffffff" strokeWidth="2.8"
        clipPath="url(#frontArc)" />

      {/* Orbit waypoint dots */}
      <circle cx="17" cy="60" r="3.2" fill="#ffffff" />   {/* left */}
      <circle cx="50" cy="71" r="4.2" fill="#E8603C" />    {/* bottom (orange) */}
      <circle cx="83" cy="60" r="3.2" fill="#ffffff" />   {/* right */}
    </svg>
  );
}
