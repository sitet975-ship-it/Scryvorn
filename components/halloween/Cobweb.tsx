import { DECORATIVE_SVG, r2 } from "./seeded";

/**
 * Geometric corner cobweb: radial spokes plus sagging capture threads.
 * Drawn for the top-left corner; mirror with `flip`.
 */
function webPath(spokes: number, rings: number): string {
  const R = 100;
  const parts: string[] = [];
  const angle = (i: number) => (Math.PI / 2) * (i / (spokes - 1));
  for (let i = 0; i < spokes; i++) {
    const a = angle(i);
    parts.push(`M0 0L${r2(R * Math.cos(a))} ${r2(R * Math.sin(a))}`);
  }
  for (let k = 1; k <= rings; k++) {
    const r = R * Math.pow(k / rings, 0.92);
    for (let i = 0; i < spokes - 1; i++) {
      const a0 = angle(i);
      const a1 = angle(i + 1);
      const am = (a0 + a1) / 2;
      const sag = r * 0.86;
      const p0 = `${r2(r * Math.cos(a0))} ${r2(r * Math.sin(a0))}`;
      const c = `${r2(sag * Math.cos(am))} ${r2(sag * Math.sin(am))}`;
      const p1 = `${r2(r * Math.cos(a1))} ${r2(r * Math.sin(a1))}`;
      parts.push(`M${p0}Q${c} ${p1}`);
    }
  }
  return parts.join("");
}

const WEB = webPath(9, 8);

export function Cobweb({
  size = 220,
  flip = false,
  opacity = 0.32,
  className = "",
}: {
  size?: number;
  flip?: boolean;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="cobweb"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ ...DECORATIVE_SVG.style, opacity, transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path d={WEB} fill="none" stroke="#EAE2D6" strokeWidth={0.9} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {/* A single loose strand and a few dew points catching amber light. */}
      <path d="M38 34 Q44 52 41 70" fill="none" stroke="#EAE2D6" strokeWidth={0.6} vectorEffect="non-scaling-stroke" opacity={0.6} />
      <circle cx="41" cy="70" r="0.9" fill="#E8892B" opacity={0.8} />
      <circle cx="63" cy="22" r="0.7" fill="#E8892B" opacity={0.6} />
      <circle cx="24" cy="58" r="0.6" fill="#E8892B" opacity={0.5} />
    </svg>
  );
}
