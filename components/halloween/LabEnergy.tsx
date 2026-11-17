import { DECORATIVE_SVG, r2, seeded } from "./seeded";

/** Jagged electrical arc between two angles on a ring (viewBox 0..200). */
function bolt(rand: () => number, a0: number, a1: number, r: number): string {
  const steps = 9;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const jitter = i === 0 || i === steps ? 0 : (rand() - 0.5) * 14;
    const rr = r + jitter;
    pts.push(`${r2(100 + rr * Math.cos(a))} ${r2(100 + rr * Math.sin(a))}`);
  }
  return `M${pts.join("L")}`;
}

const rand = seeded(1931);
const BOLTS = [
  bolt(rand, -2.6, -1.7, 92),
  bolt(rand, -0.4, 0.5, 94),
  bolt(rand, 1.2, 2.1, 90),
  bolt(rand, 2.6, 3.4, 95),
];

/**
 * Frankenstein-laboratory green energy crackling around the radar while a
 * scan request is in flight. Slow dash animation; no rapid flashing; static
 * and faint under reduced motion.
 */
export function LabEnergy({ className = "" }: { className?: string }) {
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="lab-energy"
      viewBox="0 0 200 200"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <filter id="lab-energy-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="100" cy="100" r="93" fill="none" stroke="#2F8F5B" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 5" />
      <g filter="url(#lab-energy-glow)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {BOLTS.map((d, i) => (
          <path
            key={i}
            d={d}
            className={i % 2 ? "scry-arc-late" : "scry-arc"}
            stroke="#4ADE80"
            strokeWidth="1.4"
            strokeDasharray="22 10"
            opacity="0.55"
          />
        ))}
      </g>
    </svg>
  );
}
