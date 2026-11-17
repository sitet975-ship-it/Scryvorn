import { DECORATIVE_SVG } from "./seeded";

/** One translucent ghost silhouette with a soft, tattered hem and a faint glow. */
export function Ghost({ id, width, className = "" }: { id: string; width: number; className?: string }) {
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="ghost"
      width={width}
      height={width * 1.25}
      viewBox="0 0 100 125"
      className={className}
      style={{ ...DECORATIVE_SVG.style, filter: "drop-shadow(0 0 8px rgba(234,226,214,0.35))" }}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAE2D6" stopOpacity="0.82" />
          <stop offset="70%" stopColor="#EAE2D6" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#EAE2D6" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-b`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <g filter={`url(#${id}-b)`}>
        <path
          d="M50 6 C24 6 14 30 14 56 L12 104 Q20 96 27 106 Q34 116 41 104 Q48 94 55 106 Q62 118 69 104 Q76 94 84 108 Q90 98 88 56 C86 30 76 6 50 6Z"
          fill={`url(#${id}-g)`}
        />
        <path d="M14 58 Q2 66 6 78 Q12 70 16 72Z M86 58 Q98 64 95 78 Q90 70 85 72Z" fill="#EAE2D6" opacity="0.3" />
        <ellipse cx="38" cy="44" rx="5" ry="7" fill="#070709" opacity="0.8" />
        <ellipse cx="60" cy="44" rx="5" ry="7" fill="#070709" opacity="0.8" />
        <ellipse cx="49" cy="62" rx="4" ry="6" fill="#070709" opacity="0.55" />
      </g>
    </svg>
  );
}

/**
 * Ghosts drifting behind the cathedral arches (backdrop layer, behind all
 * content). On wide screens they keep to the upper-right region beside the
 * headline and drift only a short distance (--drift), so they never sit
 * behind body text; on small screens the mobile strip shows its own ghost.
 */
export function Ghosts({ className = "" }: { className?: string }) {
  return (
    <div data-decorative="ghosts" aria-hidden="true" className={`pointer-events-none absolute inset-0 hidden lg:block ${className}`}>
      <div className="scry-ghost-a absolute left-[68%] top-[4%] opacity-80 [--drift:10vw]">
        <Ghost id="ghost-a" width={84} />
      </div>
      <div className="scry-ghost-b absolute left-[86%] top-[10%] opacity-65 [--drift:2vw]">
        <Ghost id="ghost-b" width={62} />
      </div>
      <div className="scry-ghost-c absolute left-[74%] top-[24%] opacity-55 [--drift:6vw]">
        <Ghost id="ghost-c" width={54} />
      </div>
    </div>
  );
}
