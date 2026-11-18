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
 * Ghosts drifting in the cathedral on both sides of the screen (backdrop
 * layer, behind all content). On wide screens two keep to the left edge and
 * two to the right edge, in the gutters beside the content column, and each
 * drifts only a short distance (--dx, --dy) on its own slow cycle. On small
 * screens the mobile strip shows one ghost per side instead.
 */
export const GHOSTS = [
  { id: "ghost-l1", cls: "scry-ghost-a", pos: "left-[1.5%] top-[16%]", width: 70, opacity: "opacity-75", drift: "[--dx:1.2vw] [--dy:-2vh]" },
  { id: "ghost-l2", cls: "scry-ghost-c", pos: "left-[3%] top-[52%]", width: 52, opacity: "opacity-55", drift: "[--dx:0.8vw] [--dy:3vh]" },
  { id: "ghost-r1", cls: "scry-ghost-b", pos: "right-[1.5%] top-[8%]", width: 80, opacity: "opacity-80", drift: "[--dx:-1.2vw] [--dy:2vh]" },
  { id: "ghost-r2", cls: "scry-ghost-d", pos: "right-[3%] top-[44%]", width: 56, opacity: "opacity-60", drift: "[--dx:-0.8vw] [--dy:-3vh]" },
] as const;

export function Ghosts({ className = "" }: { className?: string }) {
  return (
    <div data-decorative="ghosts" aria-hidden="true" className={`pointer-events-none absolute inset-0 hidden lg:block ${className}`}>
      {GHOSTS.map((g) => (
        <div key={g.id} data-ghost-side={g.id.startsWith("ghost-l") ? "left" : "right"} className={`${g.cls} absolute ${g.pos} ${g.opacity} ${g.drift}`}>
          <Ghost id={g.id} width={g.width} />
        </div>
      ))}
    </div>
  );
}
