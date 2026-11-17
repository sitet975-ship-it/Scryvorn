import { Bat, Bats } from "./Bats";
import { Candle, CandleCluster, Fog } from "./CandleFog";
import { Cobweb } from "./Cobweb";
import { DescendingSpider } from "./DescendingSpider";
import { Ghost, Ghosts } from "./Ghosts";
import { JackOLantern } from "./JackOLantern";
import { DECORATIVE_SVG } from "./seeded";

const PILLAR_X = [70, 250, 1190, 1370];

/** Pointed (lancet) arch path between two x positions, springing at y. */
const arch = (x0: number, x1: number, spring: number, apex: number) =>
  `M${x0} 900 V${spring} Q${x0} ${apex + (spring - apex) * 0.25} ${(x0 + x1) / 2} ${apex} Q${x1} ${apex + (spring - apex) * 0.25} ${x1} ${spring} V900`;

const VAMPIRE_PATH =
  "M0 -96 C-7 -96 -11 -90 -11 -83 C-11 -77 -8 -73 -6 -71 L-24 -64 C-40 -40 -52 -6 -60 40 L-26 30 L-14 40 L0 34 L14 40 L26 30 L60 40 C52 -6 40 -40 24 -64 L6 -71 C8 -73 11 -77 11 -83 C11 -90 7 -96 0 -96Z M-11 -86 L-16 -100 L-6 -92Z M11 -86 L16 -100 L6 -92Z";

/** Caped vampire silhouette, backlit with a faint ember rim and red eyes. */
function Vampire({ transform, opacity }: { transform: string; opacity: number }) {
  return (
    <g opacity={opacity} transform={transform}>
      <ellipse cx="0" cy="-30" rx="78" ry="92" fill="url(#cat-vampire-glow)" />
      <path d={VAMPIRE_PATH} fill="#040305" stroke="#8A3A1C" strokeWidth="1.6" strokeOpacity="0.8" />
      <path d="M-24 -64 L0 -52 L24 -64" fill="none" stroke="#B91C1C" strokeWidth="2" opacity="0.9" />
      <circle cx="-3.5" cy="-84" r="1.8" fill="#B91C1C" />
      <circle cx="3.5" cy="-84" r="1.8" fill="#B91C1C" />
    </g>
  );
}

/** Cathedral architecture: vaults, rose window, lancets, pillars, distant vampires. */
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
        <radialGradient id="cat-vampire-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8892B" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#9B2626" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#9B2626" stopOpacity="0" />
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

      {/* A vampire silhouetted against the right lancet window (beside the headline on wide screens). */}
      <Vampire transform="translate(1010 352) scale(0.7)" opacity={0.95} />

      {/* Distant nave arch with a second, restrained vampire silhouette. */}
      <path d={arch(640, 800, 520, 360)} fill="url(#cat-distance)" />
      <Vampire transform="translate(720 640)" opacity={0.9} />

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

      {/* Warm candle and lantern light pooling on the floor. */}
      <rect y="560" width="1440" height="340" fill="url(#cat-amber-floor)" />
      <path d="M0 830 L1440 830 M0 865 L1440 865 M360 900 L560 760 M1080 900 L880 760 M720 900 V760" stroke="#2A1A14" strokeOpacity="0.6" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Mobile-only Halloween strip (hidden from the sm breakpoint up), rendered as
 * its own block directly under the navigation. Because it occupies its own
 * space in the page flow, its jack-o'-lantern, ghost, bats, cobwebs, candle,
 * and fog never overlap controls or text. overflow-hidden prevents
 * horizontal scrolling.
 */
export function MobileAtmosphere() {
  return (
    <div
      data-decorative="mobile-atmosphere"
      aria-hidden="true"
      className="pointer-events-none relative h-20 overflow-hidden border-b border-scry-border/60 sm:hidden"
      style={{ background: "radial-gradient(ellipse at 82% 100%, rgba(232,137,43,0.3), transparent 55%), radial-gradient(ellipse at 14% 100%, rgba(232,137,43,0.18), transparent 50%), radial-gradient(ellipse at 50% 30%, rgba(155,38,38,0.18), transparent 60%)" }}
    >
      <Cobweb size={64} opacity={0.36} className="absolute left-0 top-0" />
      <Cobweb size={64} flip opacity={0.36} className="absolute right-0 top-0" />
      <Ghost id="mob-ghost" width={34} className="absolute left-[58%] top-2 opacity-80" />
      <Bat width={40} className="absolute left-[28%] top-2" />
      <Bat width={26} opacity={0.9} className="absolute left-[44%] top-9" />
      <Bat width={18} opacity={0.8} className="absolute left-[74%] top-3" />
      <div className="absolute bottom-0 left-[12%]">
        <Candle id="mob-cand" height={54} wax={0.8} />
      </div>
      <div className="absolute bottom-0 right-[14%]">
        <JackOLantern id="mob-jol" width={58} />
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

      {/* Large geometric cobwebs in the upper corners. */}
      <Cobweb size={240} className="absolute left-0 top-14 hidden sm:block" opacity={0.36} />
      <Cobweb size={240} flip className="absolute right-0 top-14 hidden sm:block" opacity={0.36} />
      <Cobweb size={120} flip className="absolute right-0 top-14 sm:hidden" opacity={0.22} />

      {/* A second spider descending from an arch (outside the content column on desktop). */}
      <DescendingSpider className="right-[6%] top-0 hidden lg:block" />
      <DescendingSpider className="left-[4%] top-0 hidden sm:block lg:hidden" />

      {/* Jack-o'-lanterns and candles at the pillar bases. */}
      <div className="absolute bottom-6 left-[1%] hidden items-end gap-2 lg:flex">
        <JackOLantern id="jol-bl" width={140} />
        <CandleCluster id="cand-bl" scale={0.95} />
      </div>
      <div className="absolute bottom-6 right-[1%] hidden items-end gap-2 lg:flex">
        <CandleCluster id="cand-br" scale={0.95} />
        <JackOLantern id="jol-br" width={120} face="fangs" />
      </div>

      <Fog className="h-[42%]" />
      {/* Vignette keeps the edges dark and the content column calm. */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(7,7,9,0.6) 100%)" }} />
    </div>
  );
}
