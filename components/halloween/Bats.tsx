import { DECORATIVE_SVG } from "./seeded";

const LEFT_WING =
  "M50 32 C46 24 40 21 35 25 C30 17 19 14 5 19 C13 22 17 28 17 35 C23 31 29 33 31 39 C35 35 41 35 45 41 Z";
const RIGHT_WING =
  "M50 32 C54 24 60 21 65 25 C70 17 81 14 95 19 C87 22 83 28 83 35 C77 31 71 33 69 39 C65 35 59 35 55 41 Z";

/**
 * Bat silhouette with independently flapping wings. A thin ember rim light
 * (amber/crimson drop shadow) separates the black silhouette from the dark
 * cathedral so it reads clearly without becoming bright.
 */
export function Bat({ width, opacity = 1, className = "" }: { width: number; opacity?: number; className?: string }) {
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="bat"
      width={width}
      height={width * 0.5}
      viewBox="0 0 100 50"
      className={className}
      style={{
        ...DECORATIVE_SVG.style,
        opacity,
        filter: "drop-shadow(0 0 1.5px rgba(232,137,43,0.85)) drop-shadow(0 0 6px rgba(155,38,38,0.7))",
      }}
    >
      <path className="scry-wing" d={LEFT_WING} fill="#07060A" stroke="#6B3420" strokeWidth="1" />
      <path className="scry-wing" d={RIGHT_WING} fill="#07060A" stroke="#6B3420" strokeWidth="1" />
      {/* Body and ears. */}
      <path d="M46 30 Q50 46 54 30 Q53 24 50 24 Q47 24 46 30Z M46.5 25 L45.5 19 L48.5 23.5Z M53.5 25 L54.5 19 L51.5 23.5Z" fill="#07060A" />
      <circle cx="48.6" cy="27" r="0.9" fill="#E8892B" />
      <circle cx="51.4" cy="27" r="0.9" fill="#E8892B" />
    </svg>
  );
}

/** Bats crossing the upper cathedral windows. */
export function Bats({ className = "" }: { className?: string }) {
  return (
    <div data-decorative="bats" aria-hidden="true" className={`pointer-events-none absolute inset-x-0 overflow-hidden ${className}`}>
      <div className="scry-bats absolute left-0 top-[30%] flex items-start gap-10">
        <Bat width={58} />
        <div className="mt-6"><Bat width={40} opacity={0.9} /></div>
        <div className="-mt-2"><Bat width={28} opacity={0.8} /></div>
      </div>
      <div className="scry-bats-late absolute left-0 top-[64%] flex items-start gap-14">
        <Bat width={34} opacity={0.85} />
        <div className="mt-4"><Bat width={46} opacity={0.95} /></div>
      </div>
    </div>
  );
}
