import { DECORATIVE_SVG, r2, seeded } from "./seeded";

/**
 * Signature tarantula (top-down view, facing right).
 *
 * Procedural, deterministic detail: a furred abdomen and carapace (SVG
 * turbulence displacement for a hairy edge), radial carapace striations,
 * eight jointed legs (femur, tibia, tarsus) with banded knees and hundreds
 * of individual hairs, pedipalps, chelicerae, and glowing amber eyes.
 *
 * Motion (disabled under reduced motion): alternating leg gait and a slow
 * crawl along a dedicated lower lane that never overlaps content.
 */
type Pt = { x: number; y: number };
const rand = seeded(1879);

const HIPS_X = [154, 146, 136, 126];
const HIPS_DY = [13, 18, 20, 17];
const KNEE = [
  [30, 34],
  [16, 44],
  [-8, 46],
  [-30, 38],
];
const FOOT = [
  [28, 22],
  [12, 30],
  [-14, 30],
  [-32, 22],
];

function hairsAlong(a: Pt, b: Pt, count: number, side: number, minLen: number, maxLen: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + rand() * 0.8) / count;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const dir = rand() < 0.5 ? -1 : 1;
    const l = minLen + rand() * (maxLen - minLen);
    // Hairs sweep slightly toward the foot.
    const ex = px + nx * l * dir * side + (dx / len) * l * 0.55;
    const ey = py + ny * l * dir * side + (dy / len) * l * 0.55;
    parts.push(`M${r2(px)} ${r2(py)}L${r2(ex)} ${r2(ey)}`);
  }
  return parts.join("");
}

function ellipseHairs(cx: number, cy: number, rx: number, ry: number, count: number, out: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + rand() * 0.05;
    const r0 = 0.9 + rand() * 0.08;
    const r1 = 1 + (out * (0.4 + rand() * 0.6)) / Math.max(rx, ry);
    const tilt = (rand() - 0.5) * 0.25;
    parts.push(
      `M${r2(cx + rx * r0 * Math.cos(a))} ${r2(cy + ry * r0 * Math.sin(a))}L${r2(cx + rx * r1 * Math.cos(a + tilt))} ${r2(cy + ry * r1 * Math.sin(a + tilt))}`,
    );
  }
  return parts.join("");
}

function interiorHairs(cx: number, cy: number, rx: number, ry: number, count: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.85;
    const x = cx + rx * d * Math.cos(a);
    const y = cy + ry * d * Math.sin(a);
    const l = 1.5 + rand() * 3;
    const ang = Math.atan2(y - cy, x - cx) + (rand() - 0.5) * 0.8;
    parts.push(`M${r2(x)} ${r2(y)}L${r2(x + l * Math.cos(ang))} ${r2(y + l * Math.sin(ang))}`);
  }
  return parts.join("");
}

type Leg = { side: number; i: number; hip: Pt; knee: Pt; foot: Pt; tip: Pt; hair: string; group: "a" | "b" };

const LEGS: Leg[] = [];
for (const side of [-1, 1]) {
  for (let i = 0; i < 4; i++) {
    const hip = { x: HIPS_X[i], y: 75 + side * HIPS_DY[i] };
    const knee = { x: hip.x + KNEE[i][0], y: hip.y + side * KNEE[i][1] };
    const foot = { x: knee.x + FOOT[i][0], y: knee.y + side * FOOT[i][1] };
    const tip = { x: foot.x + FOOT[i][0] * 0.18, y: foot.y + side * FOOT[i][1] * 0.14 };
    const hair =
      hairsAlong(hip, knee, 26, side, 2.2, 5.2) +
      hairsAlong(knee, foot, 22, side, 1.8, 4.4) +
      hairsAlong(foot, tip, 6, side, 1.2, 2.6);
    // Alternating tetrapod gait: L1 R2 L3 R4 vs R1 L2 R3 L4.
    const group = (i % 2 === 0) === (side === -1) ? "a" : "b";
    LEGS.push({ side, i, hip, knee, foot, tip, hair, group });
  }
}

const ABDOMEN = { cx: 80, cy: 75, rx: 40, ry: 32 };
const CARAPACE = { cx: 140, cy: 75, rx: 27, ry: 23 };
const ABDOMEN_RIM = ellipseHairs(ABDOMEN.cx, ABDOMEN.cy, ABDOMEN.rx, ABDOMEN.ry, 170, 9);
const ABDOMEN_FUR = interiorHairs(ABDOMEN.cx, ABDOMEN.cy, ABDOMEN.rx, ABDOMEN.ry, 240);
const CARAPACE_RIM = ellipseHairs(CARAPACE.cx, CARAPACE.cy, CARAPACE.rx, CARAPACE.ry, 90, 5);
const STRIATIONS = Array.from({ length: 14 }, (_, k) => {
  const a = (Math.PI * 2 * k) / 14;
  return `M${r2(CARAPACE.cx + 3 * Math.cos(a))} ${r2(CARAPACE.cy + 3 * Math.sin(a))}L${r2(CARAPACE.cx + CARAPACE.rx * 0.82 * Math.cos(a))} ${r2(CARAPACE.cy + CARAPACE.ry * 0.82 * Math.sin(a))}`;
}).join("");
const PALP_HAIR =
  hairsAlong({ x: 160, y: 66 }, { x: 178, y: 56 }, 10, -1, 1.5, 3.4) +
  hairsAlong({ x: 178, y: 56 }, { x: 190, y: 58 }, 6, -1, 1.2, 2.6) +
  hairsAlong({ x: 160, y: 84 }, { x: 178, y: 94 }, 10, 1, 1.5, 3.4) +
  hairsAlong({ x: 178, y: 94 }, { x: 190, y: 92 }, 6, 1, 1.2, 2.6);

const seg = (a: Pt, b: Pt) => `M${a.x} ${a.y}L${b.x} ${b.y}`;

export function Tarantula({ className = "h-auto w-[220px]" }: { className?: string }) {
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="tarantula"
      viewBox="0 -32 240 214"
      className={className}
    >
      <defs>
        <radialGradient id="tar-abdomen" cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#8A5E3A" />
          <stop offset="55%" stopColor="#4A2E1C" />
          <stop offset="100%" stopColor="#140B07" />
        </radialGradient>
        <radialGradient id="tar-carapace" cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#9A7046" />
          <stop offset="60%" stopColor="#553621" />
          <stop offset="100%" stopColor="#170D08" />
        </radialGradient>
        <radialGradient id="tar-eye" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFF1C4" />
          <stop offset="45%" stopColor="#FFB347" />
          <stop offset="100%" stopColor="#B4520F" />
        </radialGradient>
        <filter id="tar-fur" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="tar-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="tar-shadow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Ground shadow. */}
      <ellipse cx="118" cy="84" rx="92" ry="34" fill="#000" opacity="0.55" filter="url(#tar-shadow)" />

      {/* Legs: femur, tibia, tarsus with banded joints and hair. */}
      {LEGS.map((leg) => (
        <g
          key={`${leg.side}-${leg.i}`}
          className={leg.group === "a" ? "scry-gait-a" : "scry-gait-b"}
          style={{ transformBox: "view-box", transformOrigin: `${leg.hip.x}px ${leg.hip.y}px` }}
        >
          <path d={leg.hair} stroke="#B68A5C" strokeWidth="0.6" strokeLinecap="round" opacity="0.95" />
          <path d={seg(leg.hip, leg.knee)} stroke="#1E120B" strokeWidth="7" strokeLinecap="round" />
          <path d={seg(leg.hip, leg.knee)} stroke="#7A5234" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
          <path d={seg(leg.knee, leg.foot)} stroke="#1E120B" strokeWidth="5.4" strokeLinecap="round" />
          <path d={seg(leg.knee, leg.foot)} stroke="#7A5234" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
          <path d={seg(leg.foot, leg.tip)} stroke="#1E120B" strokeWidth="3.6" strokeLinecap="round" />
          {/* Pale knee and tibia bands. */}
          <circle cx={leg.knee.x} cy={leg.knee.y} r="4.2" fill="#A47C50" opacity="0.95" />
          <circle cx={leg.knee.x} cy={leg.knee.y} r="2.2" fill="#D2AC78" opacity="0.8" />
          <circle cx={leg.foot.x} cy={leg.foot.y} r="3" fill="#7A5A3A" opacity="0.85" />
        </g>
      ))}

      {/* Pedipalps and chelicerae. */}
      <g>
        <path d={PALP_HAIR} stroke="#B68A5C" strokeWidth="0.55" strokeLinecap="round" />
        <path d="M160 66 L178 56 L190 58 M160 84 L178 94 L190 92" stroke="#1E120B" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="178" cy="56" r="2.4" fill="#8C6A45" />
        <circle cx="178" cy="94" r="2.4" fill="#8C6A45" />
        <ellipse cx="168" cy="70" rx="7" ry="5" fill="#1A0F09" />
        <ellipse cx="168" cy="80" rx="7" ry="5" fill="#1A0F09" />
      </g>

      {/* Abdomen: furred body with interior hair and an amber rim light. */}
      <g filter="url(#tar-fur)">
        <ellipse cx={ABDOMEN.cx} cy={ABDOMEN.cy} rx={ABDOMEN.rx} ry={ABDOMEN.ry} fill="url(#tar-abdomen)" />
        <path d={ABDOMEN_RIM} stroke="#9C7048" strokeWidth="0.75" strokeLinecap="round" />
      </g>
      <path d={ABDOMEN_FUR} stroke="#B68A5C" strokeWidth="0.5" strokeLinecap="round" opacity="0.6" />
      <path
        d={`M${ABDOMEN.cx - 30} ${ABDOMEN.cy - 18} Q${ABDOMEN.cx} ${ABDOMEN.cy - 36} ${ABDOMEN.cx + 30} ${ABDOMEN.cy - 18}`}
        stroke="#E8892B"
        strokeWidth="1.6"
        fill="none"
        opacity="0.6"
      />
      {/* Pedicel. */}
      <ellipse cx="114" cy="75" rx="6" ry="5" fill="#1A0F09" />

      {/* Carapace with radial striations and fovea. */}
      <g filter="url(#tar-fur)">
        <ellipse cx={CARAPACE.cx} cy={CARAPACE.cy} rx={CARAPACE.rx} ry={CARAPACE.ry} fill="url(#tar-carapace)" />
        <path d={CARAPACE_RIM} stroke="#A47C50" strokeWidth="0.65" strokeLinecap="round" />
      </g>
      <path d={STRIATIONS} stroke="#1A0F09" strokeWidth="0.8" opacity="0.7" />
      <ellipse cx={CARAPACE.cx} cy={CARAPACE.cy} rx="2.6" ry="1.6" fill="#120A06" />

      {/* Ocular tubercle and glowing amber eyes. */}
      <ellipse cx="154" cy="75" rx="5" ry="4" fill="#0E0805" />
      <g filter="url(#tar-glow)" className="scry-glow-pulse">
        <circle cx="155.6" cy="72.9" r="2.4" fill="url(#tar-eye)" />
        <circle cx="155.6" cy="77.1" r="2.4" fill="url(#tar-eye)" />
      </g>
      <circle cx="152.4" cy="71.6" r="0.8" fill="#E8892B" opacity="0.85" />
      <circle cx="152.4" cy="78.4" r="0.8" fill="#E8892B" opacity="0.85" />
      <circle cx="157.6" cy="71.9" r="0.6" fill="#E8892B" opacity="0.7" />
      <circle cx="157.6" cy="78.1" r="0.6" fill="#E8892B" opacity="0.7" />
    </svg>
  );
}

/**
 * Reserved bottom margin (the "tarantula lane") between the main content and
 * the footer. It is its own block in the page flow, so nothing interactive is
 * ever placed in it. It holds the lane lanterns and fog; the tarantula walks
 * here via TarantulaPerimeter.
 */
export function TarantulaLane({ children }: { children?: React.ReactNode }) {
  return (
    <div data-decorative="tarantula-lane" aria-hidden="true" className="pointer-events-none relative h-40 overflow-hidden sm:h-44 lg:h-40">
      {children}
    </div>
  );
}

/**
 * The single tarantula and its reserved walking zone.
 *
 * Rendered as an absolute, clipped, pointer-transparent layer over the
 * "creature zone" (main content + the tarantula lane). The spider only ever
 * occupies space reserved for it:
 * - wide screens (lg+): the left and right gutters (reserved by main's lg
 *   padding) and the bottom lane, walking the perimeter (scry-perimeter);
 * - smaller screens: the bottom lane only (scry-lane-walk).
 * Its resting position (the still pose under reduced motion) is in the
 * bottom lane, ~20% from the left.
 *
 * Box size per breakpoint (CSS variables used by the keyframes): --tar-w is
 * the box width and --tar-box its height, matching the drawing's 240:214
 * viewBox. On lg the box is square so the spider fits the gutter when
 * rotated to walk vertically.
 *
 * Containment below lg (scry-lane-walk): the box is lifted --tar-lift above
 * the lane floor so it sits near the lane's vertical center. Its worst-case
 * extent is mid-turn (45 degrees), where the rotated box reaches
 * (w + h) * 0.3536 above and below its center: 116x103 on mobile spans
 * 2.1..156.9 px above the floor (lane h-40 = 160 px); 128x114 from sm spans
 * 2.4..173.6 px (lane h-44 = 176 px). The turn points sit 20 px in from the
 * lane edges, which covers the ~20 px sideways growth of the rotated box. So
 * the spider stays inside the lane at every point of the walk. On lg the box
 * is a 112 px square walking the perimeter (scry-perimeter).
 */
export function TarantulaPerimeter() {
  return (
    <div data-decorative="tarantula-zone" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        data-tarantula-anchor=""
        className="scry-tarantula-walk absolute left-[20%] top-[calc(100%-var(--tar-box)-var(--tar-lift))] flex h-[var(--tar-box)] w-[var(--tar-w)] items-center justify-center [--tar-box:103px] [--tar-lift:28px] [--tar-w:116px] sm:[--tar-box:114px] sm:[--tar-lift:31px] sm:[--tar-w:128px] lg:[--tar-box:112px] lg:[--tar-lift:6px] lg:[--tar-w:112px]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-[12%] rounded-[50%]"
          style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(232,137,43,0.34), rgba(232,137,43,0) 70%)", filter: "blur(6px)" }}
        />
        {/* aspect-[240/214] matches the viewBox, so the image box is exactly the drawing's size. */}
        <Tarantula className="relative aspect-[240/214] h-auto w-full" />
      </div>
    </div>
  );
}
