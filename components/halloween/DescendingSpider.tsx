import { DECORATIVE_SVG } from "./seeded";

/**
 * A small spider descending on a silk thread from a cathedral arch. The
 * thread is drawn long enough that it stays attached at every point of the
 * slow descend/ascend loop.
 */
export function DescendingSpider({ className = "" }: { className?: string }) {
  const legs = [
    "M-4 -2 Q-12 -10 -18 -4",
    "M-4 0 Q-14 -4 -20 4",
    "M-4 2 Q-13 4 -18 12",
    "M-4 3 Q-10 10 -12 18",
  ];
  return (
    <div data-decorative="descending-spider" aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
      <div className="scry-descend">
        <svg {...DECORATIVE_SVG} width={60} height={260} viewBox="-30 -230 60 260">
          <line x1="0" y1="-230" x2="0" y2="-8" stroke="#EAE2D6" strokeOpacity="0.45" strokeWidth="0.8" />
          <g>
            {legs.map((d, i) => (
              <g key={i}>
                <path d={d} stroke="#120B0A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d={d} transform="scale(-1,1)" stroke="#120B0A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </g>
            ))}
            <ellipse cx="0" cy="8" rx="7" ry="9" fill="#1A0F0C" stroke="#3A1E14" strokeWidth="0.6" />
            <ellipse cx="0" cy="-3" rx="4.5" ry="4" fill="#120B0A" />
            <circle cx="-1.6" cy="-4.4" r="1" fill="#E8892B" />
            <circle cx="1.6" cy="-4.4" r="1" fill="#E8892B" />
            <path d="M-3 6 Q0 4 3 6 M-3.5 10 Q0 8 3.5 10" stroke="#9B2626" strokeWidth="0.8" fill="none" opacity="0.8" />
          </g>
        </svg>
      </div>
    </div>
  );
}
