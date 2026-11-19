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

/** Weathered bronze with gold patina (the gargoyle's casting). */
const BRONZE = "#1C1612";
const BRONZE_DEEP = "#110D0B";
const BRONZE_EDGE = "#3A2E22";
const PATINA = "#B4913F";

/**
 * Seated winged gargoyle on a plinth, facing right (viewBox 0 0 120 100):
 * a ribbed bat wing raised behind the shoulders (the far wing peeks out
 * behind the neck), a tall pointed ear, heavy brow, an open snarling mouth
 * with teeth, a rounded haunch, and straight front legs ending in clawed
 * paws on the plinth. The plinth top is at y = 86.
 */
export const GARGOYLE_PATHS = {
  plinth: "M6 86 H114 V100 H6 Z",
  plinthEdge: "M6 86 H114 V89 H6 Z",
  farWing: "M58 42 C60 30 66 20 74 14 C72 24 72 32 75 40 Z",
  wing: "M54 46 C46 30 36 14 24 3 C22 14 17 25 9 38 C15 38 19 40 21 44 C15 49 13 55 15 61 C21 59 27 61 30 65 C31 69 35 71 41 71 Z",
  wingRibs: "M52 45 C44 30 34 15 25 5 M50 47 C38 42 22 39 11 38 M48 52 C38 53 26 56 16 60",
  wingWeb: "M21 44 C30 44 40 46 48 50 M30 65 C36 60 42 56 48 54",
  farLeg: "M84 54 C86 64 88 74 88 82 L98 82 C96 72 94 62 92 52 Z",
  body: "M24 86 C20 74 24 62 36 58 C40 50 46 44 54 40 C58 36 62 33 66 31 L82 35 C84 43 86 51 87 58 C88 66 90 76 93 86 Z",
  haunch: "M24 86 C22 72 30 62 42 62 C53 62 58 72 56 86 Z",
  nearLeg: "M70 56 C68 66 68 76 68 82 L81 82 C79 74 79 64 82 54 Z",
  paws: "M36 86 C36 81 42 79 49 80 C55 80 59 83 59 86 Z M64 86 C64 80 70 78 76 79 C82 78 86 82 86 86 Z M86 86 C86 81 91 79 96 80 C101 80 104 83 104 86 Z",
  claws: "M41 86 V83 M46 86 V82.5 M51 86 V83 M69 86 V82.5 M74 86 V82 M79 86 V82.5 M91 86 V83 M96 86 V82.5 M100 86 V83",
  head: "M64 32 C62 22 68 14 78 12 C86 10 94 12 98 18 C102 20 106 24 106 30 C106 34 104 36 102 37 C104 40 102 44 98 45 C92 47 84 46 78 44 C72 42 66 38 64 32 Z",
  ear: "M67 21 C63 13 63 5 67 0 C73 2 78 8 78 15 Z",
  earInner: "M68.5 16 C66.5 10.5 66.5 6 68.5 3.5 C71.5 5.5 74.5 9.5 74.5 13.5 Z",
  horns: "M84 12.5 L86 8 L88.5 12 Z M90.5 13 L93.5 9 L94.5 14.5 Z",
  mouth: "M89.5 33 C95 31.5 101 32.5 103.5 35 C101.5 39.5 96 41.5 91 40.5 C88.8 38.5 88.6 35.2 89.5 33 Z",
  teeth: "M92 33.4 L93 35.6 L94 33.2 Z M96 33 L97 35.4 L98 33.1 Z M100 33.6 L100.8 35.6 L101.8 34 Z M93.5 40.4 L94.4 38.6 L95.4 40.6 Z M98 40 L98.8 38.4 L99.8 39.6 Z",
  brow: "M79 23 C83 18.5 89 18 94 21",
  snout: "M98 19 C102 20 105 24 104.5 28 M96 44 C93 42.5 91 41.5 90 40.5",
  patinaEdges: "M24 3 C22 14 17 25 9 38 M54 40 C58 36 62 33 66 31 M66 26 C66 18 72 13 80 12 C88 11 94 13 98 18 M24 80 C24 70 30 62 42 62 M70 60 C69 66 69 72 69 78 M65 81 C68 79 72 78 76 79",
} as const;

/** Gargoyle as an SVG group, for use inside the cathedral artwork. */
export function GargoyleGroup({ transform }: { transform: string }) {
  const P = GARGOYLE_PATHS;
  return (
    <g data-decorative="gargoyle" transform={transform}>
      <path d={P.plinth} fill="#120B0B" stroke={STONE} strokeWidth="1.5" />
      <path d={P.plinthEdge} fill={STONE_LIGHT} opacity="0.45" />

      {/* Wings behind the body. */}
      <path d={P.farWing} fill={BRONZE_DEEP} stroke={BRONZE_EDGE} strokeWidth="1" />
      <path d={P.wing} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={P.wingWeb} fill="none" stroke={BRONZE_DEEP} strokeWidth="1.6" strokeLinecap="round" />
      <path d={P.wingRibs} fill="none" stroke={PATINA} strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round" />

      {/* Seated body: far leg, torso, haunch, near leg, paws. */}
      <path d={P.farLeg} fill={BRONZE_DEEP} stroke={BRONZE_EDGE} strokeWidth="1" />
      <path d={P.body} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={P.haunch} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1.2" />
      <path d={P.nearLeg} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1.1" />
      <path d={P.paws} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1" />
      <path d={P.claws} fill="none" stroke={BRONZE_DEEP} strokeWidth="0.9" strokeLinecap="round" />

      {/* Head: ear, skull, horn nubs, brow, snarling mouth. */}
      <path d={P.ear} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1.1" strokeLinejoin="round" />
      <path d={P.earInner} fill={BRONZE_DEEP} />
      <path d={P.head} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={P.horns} fill={BRONZE} stroke={BRONZE_EDGE} strokeWidth="0.8" />
      <path d={P.mouth} fill="#050304" stroke={BRONZE_EDGE} strokeWidth="0.8" />
      <path d={P.teeth} fill="#8C7A5A" opacity="0.75" />
      <path d={P.brow} fill="none" stroke={PATINA} strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <path d={P.snout} fill="none" stroke={BRONZE_DEEP} strokeWidth="1" strokeLinecap="round" />
      <circle cx="87" cy="25" r="1.5" fill={EMBER} opacity="0.85" />

      {/* Gold patina on the raised edges, as on weathered cast bronze. */}
      <path d={P.patinaEdges} fill="none" stroke={PATINA} strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
      <g fill={PATINA} opacity="0.08">
        <ellipse cx="36" cy="26" rx="4" ry="2" transform="rotate(-50 36 26)" />
        <ellipse cx="60" cy="50" rx="3" ry="5" />
        <ellipse cx="34" cy="70" rx="4" ry="2.5" />
        <ellipse cx="86" cy="19" rx="3.5" ry="1.6" />
      </g>
    </g>
  );
}
