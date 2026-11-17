import { LabEnergy } from "@/components/halloween/LabEnergy";
import { DECORATIVE_SVG, r2 } from "@/components/halloween/seeded";

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180;
  const long = i % 6 === 0;
  const r0 = long ? 78 : 82;
  return `M${r2(100 + r0 * Math.cos(a))} ${r2(100 + r0 * Math.sin(a))}L${r2(100 + 86 * Math.cos(a))} ${r2(100 + 86 * Math.sin(a))}`;
}).join("");

/**
 * Circular forensic radar / reticle. Decorative: the visible state text is
 * rendered by the caller as real text; this SVG is aria-hidden. While a scan
 * request is in flight (`active`) the sweep speeds up and green laboratory
 * energy crackles around the ring.
 */
export function ForensicRadar({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px] sm:max-w-[280px]">
      {/* Ambient green-and-amber halo: slow pulse; a still glow under reduced motion. */}
      <div aria-hidden="true" data-decorative="radar-ambient" className="scry-ambient-ring absolute inset-[5%] rounded-full" />
      <svg {...DECORATIVE_SVG} data-decorative="radar" viewBox="0 0 200 200" className="relative h-full w-full">
        <defs>
          <radialGradient id="radar-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E8892B" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#9B2626" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#070709" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E8892B" stopOpacity="0" />
            <stop offset="100%" stopColor="#E8892B" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="88" fill="url(#radar-core)" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="#9B2626" strokeOpacity="0.6" strokeWidth="1" />
        <circle cx="100" cy="100" r="64" fill="none" stroke="#9B2626" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="3 4" />
        <circle cx="100" cy="100" r="42" fill="none" stroke="#E8892B" strokeOpacity="0.35" strokeWidth="0.8" />
        <circle cx="100" cy="100" r="20" fill="none" stroke="#E8892B" strokeOpacity="0.5" strokeWidth="0.8" />
        <path d={TICKS} stroke="#E8892B" strokeOpacity="0.45" strokeWidth="0.7" />
        <path d="M100 6 V194 M6 100 H194" stroke="#9B2626" strokeOpacity="0.4" strokeWidth="0.6" />
        <path d="M70 70 h-8 v8 M130 70 h8 v8 M70 130 h-8 v-8 M130 130 h8 v-8" stroke="#E8892B" strokeOpacity="0.7" strokeWidth="1" fill="none" />
        <g className={active ? "scry-sweep-fast" : "scry-sweep"} style={{ transformBox: "view-box", transformOrigin: "100px 100px" }}>
          <path d="M100 100 L186 100 A86 86 0 0 0 160.8 39.2 Z" fill="url(#radar-sweep)" />
          <path d="M100 100 L186 100" stroke="#E8892B" strokeWidth="1" strokeOpacity="0.8" />
        </g>
        <circle cx="100" cy="100" r="2.4" fill="#E8892B" />
      </svg>
      {active ? <LabEnergy /> : null}
      <p
        aria-hidden="true"
        data-radar-label=""
        className="absolute inset-0 flex items-center justify-center text-center font-sans text-[0.7rem] font-semibold uppercase leading-tight tracking-[0.2em] text-scry-amber"
      >
        <span className="max-w-[7rem]">{label}</span>
      </p>
    </div>
  );
}
