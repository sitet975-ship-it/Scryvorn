import { DECORATIVE_SVG } from "./seeded";

/**
 * Gothic architectural details for the cathedral backdrop (they replace the
 * former corner cobwebs). Static stone artwork: no animation, no filters.
 */

const STONE = "#3B2A25";
const STONE_LIGHT = "#5A4034";
const EMBER = "#E8892B";

/**
 * Corner tracery: a stone spandrel in the top-left corner with two vault
 * ribs, a cusped inner arch, and a quatrefoil rosette. Mirror with `flip`.
 */
export function CornerTracery({
  size = 220,
  flip = false,
  opacity = 0.6,
  className = "",
}: {
  size?: number;
  flip?: boolean;
  opacity?: number;
  className?: string;
}) {
  const cusps = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI / 2) * ((i + 0.5) / 5);
    const r = 66;
    const x = 4 + r * Math.cos(a);
    const y = 4 + r * Math.sin(a);
    return `M${(x - 5 * Math.sin(a)).toFixed(2)} ${(y + 5 * Math.cos(a)).toFixed(2)} Q${(x - 5 * Math.cos(a)).toFixed(2)} ${(y - 5 * Math.sin(a)).toFixed(2)} ${(x + 5 * Math.sin(a)).toFixed(2)} ${(y - 5 * Math.cos(a)).toFixed(2)}`;
  }).join(" ");
  const foil = (cx: number, cy: number, r: number) =>
    [0, 1, 2, 3].map((k) => {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      return <circle key={k} cx={cx + r * 0.62 * Math.cos(a)} cy={cy + r * 0.62 * Math.sin(a)} r={r * 0.46} fill="none" stroke={STONE_LIGHT} strokeWidth="1.4" />;
    });
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="tracery"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ ...DECORATIVE_SVG.style, opacity, transform: flip ? "scaleX(-1)" : undefined }}
    >
      {/* Stone spandrel filling the corner outside the outer rib. */}
      <path d="M0 0 H100 V3 Q14 6 3 100 H0 Z" fill="#140D0D" />
      <path d="M100 3 Q14 6 3 100" fill="none" stroke={STONE} strokeWidth="5" />
      <path d="M100 3 Q14 6 3 100" fill="none" stroke={EMBER} strokeOpacity="0.22" strokeWidth="1" />
      {/* Inner rib with cusps. */}
      <path d="M74 4 Q8 8 4 74" fill="none" stroke={STONE} strokeWidth="3" />
      <path d={cusps} fill="none" stroke={STONE_LIGHT} strokeWidth="1.2" />
      {/* Quatrefoil rosette in the corner. */}
      <circle cx="26" cy="26" r="15" fill="#0E0909" stroke={STONE} strokeWidth="2.4" />
      {foil(26, 26, 13)}
      <circle cx="26" cy="26" r="2.2" fill={EMBER} opacity="0.55" />
      {/* Small trefoil in the outer spandrel. */}
      <g opacity="0.85">
        <circle cx="62" cy="10" r="3" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
        <circle cx="57.5" cy="13.5" r="3" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
        <circle cx="66.5" cy="13.5" r="3" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
        <circle cx="10" cy="62" r="3" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
        <circle cx="13.5" cy="57.5" r="3" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
        <circle cx="13.5" cy="66.5" r="3" fill="none" stroke={STONE_LIGHT} strokeWidth="1" />
      </g>
    </svg>
  );
}

/** Crouching winged gargoyle silhouette on a plinth, facing right (viewBox 0 0 120 100). */
export const GARGOYLE_PATHS = {
  plinth: "M8 86 H112 V100 H8 Z M14 80 H106 V86 H14 Z",
  wing: "M46 56 C38 40 24 28 8 24 C16 33 19 42 16 52 C24 47 30 50 32 58 C36 54 41 54 46 60 Z",
  body: "M28 80 C26 66 32 56 44 52 C48 42 56 36 66 36 C70 28 80 24 88 30 L95 22 L95 34 C102 40 104 48 99 54 L104 58 L94 60 C90 66 84 70 84 80 Z M40 80 L44 72 L50 80 Z M62 80 L66 70 L72 80 Z",
} as const;

/** Gargoyle as an SVG group, for use inside the cathedral artwork. */
export function GargoyleGroup({ transform }: { transform: string }) {
  return (
    <g data-decorative="gargoyle" transform={transform}>
      <path d={GARGOYLE_PATHS.plinth} fill="#120B0B" stroke={STONE} strokeWidth="1.5" />
      <path d={GARGOYLE_PATHS.wing} fill="#0B0708" stroke={STONE_LIGHT} strokeWidth="1.4" />
      <path d={GARGOYLE_PATHS.body} fill="#0B0708" stroke={STONE_LIGHT} strokeWidth="1.6" />
      <path d={GARGOYLE_PATHS.body} fill="none" stroke={EMBER} strokeOpacity="0.25" strokeWidth="0.8" />
      <circle cx="90" cy="38" r="1.6" fill={EMBER} opacity="0.85" />
    </g>
  );
}
