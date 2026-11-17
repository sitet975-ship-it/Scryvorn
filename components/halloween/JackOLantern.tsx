import { DECORATIVE_SVG } from "./seeded";

/**
 * Carved jack-o'-lantern with ribbed shell, curled stem, and a glowing carved
 * face. The inner light flickers slowly (disabled under reduced motion).
 * `id` must be unique per instance (gradient and filter ids).
 */
export function JackOLantern({
  id,
  width = 120,
  face = "grin",
  className = "",
}: {
  id: string;
  width?: number;
  face?: "grin" | "fangs";
  className?: string;
}) {
  const shell = `${id}-shell`;
  const rib = `${id}-rib`;
  const glow = `${id}-glow`;
  const blur = `${id}-blur`;
  const spill = `${id}-spill`;
  const mouth =
    face === "grin"
      ? "M30 68 Q40 74 46 70 L50 76 L55 70 L62 76 L67 70 L72 76 L77 70 Q84 74 92 68 Q86 90 61 92 Q37 90 30 68Z"
      : "M32 70 Q61 86 90 70 Q84 92 61 94 Q38 92 32 70Z M44 74 L48 82 L52 76Z M70 76 L74 82 L78 74Z";
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="jack-o-lantern"
      width={width}
      height={(width * 112) / 122}
      viewBox="0 0 122 112"
      className={className}
    >
      <defs>
        <radialGradient id={shell} cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#F59E3B" />
          <stop offset="45%" stopColor="#C2561A" />
          <stop offset="85%" stopColor="#6B2410" />
          <stop offset="100%" stopColor="#2A0E06" />
        </radialGradient>
        <linearGradient id={rib} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#FFF4C2" />
          <stop offset="40%" stopColor="#FFC24A" />
          <stop offset="100%" stopColor="#E8892B" />
        </radialGradient>
        <radialGradient id={spill} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8892B" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#E8892B" stopOpacity="0" />
        </radialGradient>
        <filter id={blur} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      {/* Light spilling onto the stone floor. */}
      <ellipse className="scry-glow-pulse" cx="61" cy="104" rx="60" ry="9" fill={`url(#${spill})`} />
      {/* Shell: overlapping lobes. */}
      <ellipse cx="34" cy="62" rx="26" ry="36" fill={`url(#${shell})`} />
      <ellipse cx="88" cy="62" rx="26" ry="36" fill={`url(#${shell})`} />
      <ellipse cx="50" cy="60" rx="24" ry="40" fill={`url(#${shell})`} />
      <ellipse cx="72" cy="60" rx="24" ry="40" fill={`url(#${shell})`} />
      <ellipse cx="61" cy="59" rx="20" ry="41" fill={`url(#${shell})`} />
      {/* Rib shading. */}
      {[36, 50, 72, 86].map((x) => (
        <path key={x} d={`M${x} 26 Q${x + (x < 61 ? -6 : 6)} 60 ${x} 96`} stroke={`url(#${rib})`} strokeWidth="3" fill="none" />
      ))}
      {/* Stem. */}
      <path d="M57 22 Q55 10 62 4 Q66 2 67 6 Q62 12 65 22 Z" fill="#3B3A1E" stroke="#1C1B0D" strokeWidth="1" />
      <path d="M66 8 Q76 2 80 10" fill="none" stroke="#3B3A1E" strokeWidth="1.6" strokeLinecap="round" />
      {/* Carved face, lit from inside. */}
      <g className="scry-flicker">
        <g filter={`url(#${blur})`} opacity="0.8">
          <path d="M36 44 L48 56 L30 58Z M86 44 L74 56 L92 58Z M61 58 L66 66 L56 66Z" fill="#FFB347" />
          <path d={mouth} fill="#FFB347" />
        </g>
        <path d="M36 44 L48 56 L30 58Z M86 44 L74 56 L92 58Z M61 58 L66 66 L56 66Z" fill={`url(#${glow})`} />
        <path d={mouth} fill={`url(#${glow})`} fillRule="evenodd" />
      </g>
      {/* Carved edge thickness. */}
      <path d="M36 44 L48 56 L30 58Z M86 44 L74 56 L92 58Z" fill="none" stroke="#5A1E0B" strokeWidth="1.2" />
    </svg>
  );
}
