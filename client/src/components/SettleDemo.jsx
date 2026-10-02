import { useEffect, useState } from "react";

/**
 * Landing-page demo of debt simplification: the same four friends and the same balances,
 * first as 6 separate debts, then as the 2 payments TripSquad suggests.
 * Numbers are consistent: everyone's net balance is identical in both views.
 */
const PEOPLE = {
  aman: { name: "Aman", x: 90, y: 78, color: "#4338ca", net: 500 },
  riya: { name: "Riya", x: 390, y: 78, color: "#c2410c", net: 500 },
  leo: { name: "Leo", x: 90, y: 318, color: "#b45309", net: -500 },
  sara: { name: "Sara", x: 390, y: 318, color: "#15803d", net: -500 },
};
const BEFORE = [
  ["leo", "aman", 300, 0],
  ["sara", "aman", 150, 26, 0.3],
  ["riya", "aman", 50, 0],
  ["leo", "riya", 300, -26, 0.3],
  ["sara", "riya", 250, 0],
  ["sara", "leo", 100, 0],
];
const AFTER = [
  ["leo", "aman", 500, 0],
  ["sara", "riya", 500, 0],
];
const R = 34;

function Arrow({ from, to, amount, bend, visible, delay, final = false, at = 0.5 }) {
  const a = PEOPLE[from], b = PEOPLE[to];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const sx = a.x + ux * (R + 4), sy = a.y + uy * (R + 4);
  const ex = b.x - ux * (R + 10), ey = b.y - uy * (R + 10);
  const cx = (sx + ex) / 2 - uy * bend * 3, cy = (sy + ey) / 2 + ux * bend * 3;
  // Label sits on the curve at t = at (moved off the middle where the diagonals cross)
  const q = (p0, p1, p2) => (1 - at) ** 2 * p0 + 2 * (1 - at) * at * p1 + at ** 2 * p2;
  const lx = q(sx, cx, ex), ly = q(sy, cy, ey);
  return (
    <g className={`settle-arrow ${visible ? "is-on" : ""} ${final ? "is-final" : ""}`} style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}>
      <path d={`M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}`} markerEnd={`url(#${final ? "settle-head-final" : "settle-head"})`} />
      <g transform={`translate(${lx} ${ly})`}>
        <rect x="-30" y="-13" width="60" height="26" rx="13" />
        <text textAnchor="middle" dy="4.5">€{amount}</text>
      </g>
    </g>
  );
}

export default function SettleDemo() {
  const [simple, setSimple] = useState(false);
  const [auto, setAuto] = useState(true);

  // Plays by itself until the visitor clicks one of the buttons
  useEffect(() => {
    if (!auto) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setSimple((s) => !s), 3600);
    return () => clearInterval(t);
  }, [auto]);

  const choose = (value) => {
    setAuto(false);
    setSimple(value);
  };

  return (
    <div className="settle-demo">
      <div className="settle-toggle" role="group" aria-label="Show debts">
        <button className={!simple ? "is-active" : ""} onClick={() => choose(false)} aria-pressed={!simple}>
          Who owes whom · <strong>6 payments</strong>
        </button>
        <button className={simple ? "is-active" : ""} onClick={() => choose(true)} aria-pressed={simple}>
          TripSquad · <strong>2 payments</strong>
        </button>
      </div>
      <svg viewBox="0 0 480 406" className="settle-svg" role="img" aria-label={simple ? "Two payments: Leo pays Aman €500, Sara pays Riya €500" : "Six separate debts between four friends"}>
        <defs>
          <marker id="settle-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="settle-head" />
          </marker>
          <marker id="settle-head-final" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="settle-head-final" />
          </marker>
        </defs>
        {BEFORE.map(([f, t, amt, bend, at], i) => (
          <Arrow key={`b${i}`} from={f} to={t} amount={amt} bend={bend} at={at} visible={!simple} delay={i * 60} />
        ))}
        {AFTER.map(([f, t, amt, bend], i) => (
          <Arrow key={`a${i}`} from={f} to={t} amount={amt} bend={bend} visible={simple} delay={200 + i * 120} final />
        ))}
        {Object.entries(PEOPLE).map(([id, p]) => (
          <g key={id} className="settle-node">
            <circle cx={p.x} cy={p.y} r={R} fill={p.color} />
            <text x={p.x} y={p.y + 6} textAnchor="middle" className="settle-initial">{p.name[0]}</text>
            <text x={p.x} y={p.y + (p.y < 200 ? -46 : 58)} textAnchor="middle" className="settle-name">{p.name}</text>
            <text x={p.x} y={p.y + (p.y < 200 ? -62 : 76)} textAnchor="middle" className={`settle-net ${p.net > 0 ? "pos" : "neg"}`}>
              {p.net > 0 ? `gets €${p.net}` : `owes €${-p.net}`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
