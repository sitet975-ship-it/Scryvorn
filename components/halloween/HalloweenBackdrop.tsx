import { Bat, Bats } from "./Bats";
import { Candle, CandleCluster, Fog } from "./CandleFog";
import { DescendingSpider } from "./DescendingSpider";
import { Ghost, Ghosts } from "./Ghosts";
import { CornerTracery, GargoyleGroup } from "./GothicDetails";
import { JackOLantern } from "./JackOLantern";
import { DECORATIVE_SVG } from "./seeded";

const PILLAR_X = [70, 250, 1190, 1370];

/** Pointed (lancet) arch path between two x positions, springing at y. */
const arch = (x0: number, x1: number, spring: number, apex: number) =>
  `M${x0} 900 V${spring} Q${x0} ${apex + (spring - apex) * 0.25} ${(x0 + x1) / 2} ${apex} Q${x1} ${apex + (spring - apex) * 0.25} ${x1} ${spring} V900`;

/** Cathedral architecture: vaults, rose window, lancets, pillars, gargoyles. */
function Cathedral() {
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="cathedral"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="cat-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B0A0E" />
          <stop offset="60%" stopColor="#120C0D" />
          <stop offset="100%" stopColor="#0A0708" />
        </linearGradient>
        <radialGradient id="cat-window" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#E8892B" stopOpacity="0.65" />
          <stop offset="55%" stopColor="#9B2626" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3A0F0F" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id="cat-amber-floor" cx="50%" cy="100%" r="70%">
          <stop offset="0%" stopColor="#E8892B" stopOpacity="0.34" />
          <stop offset="60%" stopColor="#9B2626" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#070709" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cat-pillar" x1="0" x2="1">
          <stop offset="0%" stopColor="#050406" />
          <stop offset="40%" stopColor="#1A1214" />
          <stop offset="70%" stopColor="#2A1A14" />
          <stop offset="100%" stopColor="#070506" />
        </linearGradient>
        <linearGradient id="cat-distance" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#24120F" />
          <stop offset="100%" stopColor="#3A1C12" />
        </linearGradient>
        <filter id="cat-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="1440" height="900" fill="url(#cat-wall)" />

      {/* Rose window with tracery. */}
      <g opacity="0.9">
        <circle cx="720" cy="190" r="110" fill="url(#cat-window)" filter="url(#cat-soft)" />
        <circle cx="720" cy="190" r="92" fill="none" stroke="#2A1414" strokeWidth="6" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <line
              key={i}
              x1="720"
              y1="190"
              x2={720 + 92 * Math.cos(a)}
              y2={190 + 92 * Math.sin(a)}
              stroke="#1E0F0F"
              strokeWidth="4"
            />
          );
        })}
        <circle cx="720" cy="190" r="34" fill="none" stroke="#1E0F0F" strokeWidth="5" />
      </g>

      {/* Lancet windows. */}
      {[430, 1010].map((x) => (
        <g key={x} opacity="0.8">
          <path d={`M${x - 40} 420 V230 Q${x - 40} 150 ${x} 120 Q${x + 40} 150 ${x + 40} 230 V420Z`} fill="url(#cat-window)" filter="url(#cat-soft)" />
          <path d={`M${x - 40} 420 V230 Q${x - 40} 150 ${x} 120 Q${x + 40} 150 ${x + 40} 230 V420Z M${x} 130 V420 M${x - 40} 300 H${x + 40}`} fill="none" stroke="#1E0F0F" strokeWidth="5" />
        </g>
      ))}

      {/* Distant nave arch with its own small lancet tracery. */}
      <path d={arch(640, 800, 520, 360)} fill="url(#cat-distance)" />
      <path d={`${arch(680, 760, 560, 440)} M720 440 V900`} fill="none" stroke="#1E0F0F" strokeWidth="4" opacity="0.8" />

      {/* Nave arcade arches. */}
      <path d={`${arch(330, 640, 470, 250)} ${arch(800, 1110, 470, 250)}`} fill="none" stroke="#1E1315" strokeWidth="14" />
      <path d={`${arch(330, 640, 470, 250)} ${arch(800, 1110, 470, 250)}`} fill="none" stroke="#E8892B" strokeOpacity="0.12" strokeWidth="2" />

      {/* Vault ribs. */}
      <path d="M0 120 Q720 -60 1440 120 M150 0 Q720 260 1290 0" fill="none" stroke="#1A1012" strokeWidth="10" />

      {/* Pillars with amber rim light and capitals. */}
      {PILLAR_X.map((x, i) => (
        <g key={x}>
          <rect x={x - 46} y="60" width="92" height="840" fill="url(#cat-pillar)" />
          <rect x={x + (i < 2 ? 34 : -46)} y="60" width="12" height="840" fill="#E8892B" opacity="0.1" />
          <rect x={x - 58} y="300" width="116" height="22" fill="#140D0E" />
          <rect x={x - 54} y="840" width="108" height="60" fill="#0E0909" />
        </g>
      ))}

      {/*
        Stone gargoyles perched on the outer pillar capitals, facing the nave.
        The outer pillars sit in the side gutters, so the gargoyles never sit
        behind the headline (on narrower screens they are cropped away).
      */}
      <GargoyleGroup transform="translate(19 214) scale(0.86)" />
      <GargoyleGroup transform="translate(1421 214) scale(-0.86 0.86)" />

      {/* Warm candle and lantern light pooling on the floor. */}
      <rect y="560" width="1440" height="340" fill="url(#cat-amber-floor)" />
      <path d="M0 830 L1440 830 M0 865 L1440 865 M360 900 L560 760 M1080 900 L880 760 M720 900 V760" stroke="#2A1A14" strokeOpacity="0.6" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Mobile-only Halloween strip (hidden from the sm breakpoint up), rendered as
 * its own block directly under the navigation. Because it occupies its own
 * space in the page flow, its gothic corner tracery, ghosts (one per side),
 * independently flying bats, candle, and fog never overlap controls or text.
 * The lantern lives in the bottom lane, so the two areas do not repeat each
 * other. overflow-hidden prevents horizontal scrolling.
 */
export function MobileAtmosphere() {
  return (
    <div
      data-decorative="mobile-atmosphere"
      aria-hidden="true"
      className="pointer-events-none relative h-20 overflow-hidden border-b border-scry-border/60 sm:hidden"
      style={{ background: "radial-gradient(ellipse at 82% 100%, rgba(232,137,43,0.3), transparent 55%), radial-gradient(ellipse at 14% 100%, rgba(232,137,43,0.18), transparent 50%), radial-gradient(ellipse at 50% 30%, rgba(155,38,38,0.18), transparent 60%)" }}
    >
      <CornerTracery size={64} opacity={0.7} className="absolute left-0 top-0" />
      <CornerTracery size={64} flip opacity={0.7} className="absolute right-0 top-0" />
      {/* Ghosts on both sides; bats each on their own small flight path. */}
      <div className="scry-ghost-m1 absolute left-[20%] top-2 opacity-80">
        <Ghost id="mob-ghost-l" width={30} />
      </div>
      <div className="scry-ghost-m2 absolute left-[76%] top-3 opacity-70">
        <Ghost id="mob-ghost-r" width={26} />
      </div>
      <div className="scry-bat-m1 absolute left-[38%] top-2">
        <Bat width={34} flap="1.15s" />
      </div>
      <div className="scry-bat-m2 absolute left-[54%] top-9">
        <Bat width={22} opacity={0.9} flap="0.95s" />
      </div>
      <div className="scry-bat-m3 absolute left-[64%] top-1">
        <Bat width={16} opacity={0.8} flap="1.35s" />
      </div>
      <div className="absolute bottom-0 left-[6%]">
        <Candle id="mob-cand" height={50} wax={0.8} />
      </div>
      <Fog className="h-full" />
    </div>
  );
}

/**
 * Full-viewport Halloween backdrop, fixed behind all content (z-0). Every
 * layer is decorative: aria-hidden, not focusable, pointer-events none, and
 * clipped (overflow-hidden) so nothing can cause horizontal scrolling.
 * Content panels sit above it with opaque card backgrounds.
 */
export function HalloweenBackdrop() {
  return (
    <div
      data-decorative="halloween-backdrop"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Cathedral />
      <Ghosts />
      <Bats className="top-[4%] h-[34%]" />

      {/* Gothic corner tracery in the upper corners (stone vault spandrels). */}
      <CornerTracery size={220} className="absolute left-0 top-14 hidden sm:block" opacity={0.75} />
      <CornerTracery size={220} flip className="absolute right-0 top-14 hidden sm:block" opacity={0.75} />

      {/* A spider descending from an arch (outside the content column on desktop). */}
      <DescendingSpider className="right-[6%] top-0 hidden lg:block" />
      <DescendingSpider className="left-[4%] top-0 hidden sm:block lg:hidden" />

      {/* One lantern and one candle group, at opposite pillar bases. */}
      <div className="absolute bottom-6 left-[1%] hidden lg:block">
        <JackOLantern id="jol-bl" width={132} />
      </div>
      <div className="absolute bottom-6 right-[2%] hidden lg:block">
        <CandleCluster id="cand-br" scale={0.9} />
      </div>

      <Fog className="h-[42%]" />
      {/* Vignette keeps the edges dark and the content column calm. */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(7,7,9,0.6) 100%)" }} />
    </div>
  );
}
