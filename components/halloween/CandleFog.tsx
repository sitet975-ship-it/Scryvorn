import { DECORATIVE_SVG } from "./seeded";

/**
 * Gothic candle with pooled, dripping wax and a slowly flickering flame.
 * `id` must be unique per instance.
 */
export function Candle({
  id,
  height = 120,
  wax = 0.7,
  className = "",
}: {
  id: string;
  height?: number;
  /** 0..1: how much of the candle remains. */
  wax?: number;
  className?: string;
}) {
  const body = `${id}-body`;
  const flame = `${id}-flame`;
  const halo = `${id}-halo`;
  const top = 40 + (1 - wax) * 50;
  return (
    <svg
      {...DECORATIVE_SVG}
      data-decorative="candle"
      width={(height * 44) / 140}
      height={height}
      viewBox="0 0 44 140"
      className={className}
    >
      <defs>
        <linearGradient id={body} x1="0" x2="1">
          <stop offset="0%" stopColor="#8C7B62" />
          <stop offset="35%" stopColor="#E8DCC2" />
          <stop offset="70%" stopColor="#CDBC9C" />
          <stop offset="100%" stopColor="#6E5F4A" />
        </linearGradient>
        <radialGradient id={flame} cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#FFFBEA" />
          <stop offset="35%" stopColor="#FFD27A" />
          <stop offset="80%" stopColor="#E8892B" />
          <stop offset="100%" stopColor="#9B2626" stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id={halo} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFC24A" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#E8892B" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Pooled wax on the stone. */}
      <ellipse cx="22" cy="134" rx="20" ry="5" fill="#D9CBAE" opacity="0.85" />
      <ellipse cx="22" cy="133" rx="14" ry="3" fill="#EFE5CF" opacity="0.6" />
      {/* Body. */}
      <rect x="12" y={top} width="20" height={134 - top} rx="2" fill={`url(#${body})`} />
      {/* Drips. */}
      <path
        d={`M12 ${top + 2} q2 10 0 18 q-1 4 1 6 q2 -6 2 -24 Z M24 ${top + 1} q1 16 -1 26 q0 4 2 4 q2 -12 1 -30 Z M30 ${top + 2} q2 8 1 12 q2 2 2 -12 Z`}
        fill="#F2E8D2"
        opacity="0.9"
      />
      <ellipse cx="22" cy={top} rx="10" ry="2.4" fill="#F7EEDB" />
      {/* Wick. */}
      <path d={`M22 ${top} q1 -4 0 -7`} stroke="#1A1614" strokeWidth="1.2" fill="none" />
      {/* Flame and halo. */}
      <g className="scry-flicker" style={{ transformOrigin: `22px ${top - 6}px`, transformBox: "view-box" }}>
        <ellipse cx="22" cy={top - 14} rx="21" ry="26" fill={`url(#${halo})`} />
        <path d={`M22 ${top - 30} C30 ${top - 18} 28 ${top - 6} 22 ${top - 5} C16 ${top - 6} 14 ${top - 18} 22 ${top - 30}Z`} fill={`url(#${flame})`} />
        <path d={`M22 ${top - 22} C25 ${top - 15} 24 ${top - 9} 22 ${top - 8} C20 ${top - 9} 19 ${top - 15} 22 ${top - 22}Z`} fill="#FFFBEA" opacity="0.85" />
      </g>
    </svg>
  );
}

/** A small cluster of candles of varying height. */
export function CandleCluster({ id, scale = 1, className = "" }: { id: string; scale?: number; className?: string }) {
  return (
    <div data-decorative="candles" aria-hidden="true" className={`flex items-end gap-1 ${className}`}>
      <Candle id={`${id}-a`} height={96 * scale} wax={0.55} />
      <Candle id={`${id}-b`} height={130 * scale} wax={0.9} />
      <Candle id={`${id}-c`} height={78 * scale} wax={0.35} />
    </div>
  );
}

/**
 * Low drifting fog: wide, soft, slow-moving bands. The softness comes from
 * multi-stop radial gradients rather than CSS blur filters, so moving the
 * bands does not force the browser to re-blur large areas every frame.
 */
export function Fog({ className = "" }: { className?: string }) {
  return (
    <div data-decorative="fog" aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`}>
      <div
        className="scry-fog-a absolute -left-[10%] bottom-[-30%] h-[120%] w-[120%] rounded-[50%]"
        style={{ background: "radial-gradient(ellipse at 30% 60%, rgba(234,226,214,0.15), rgba(234,226,214,0.07) 32%, rgba(234,226,214,0.02) 52%, transparent 66%)" }}
      />
      <div
        className="scry-fog-b absolute -left-[10%] bottom-[-40%] h-[120%] w-[120%] rounded-[50%]"
        style={{ background: "radial-gradient(ellipse at 70% 55%, rgba(234,226,214,0.13), rgba(234,226,214,0.06) 34%, rgba(234,226,214,0.015) 54%, transparent 68%)" }}
      />
      {/* Low ember-lit band: candle and lantern light caught in the fog. */}
      <div
        className="scry-fog-a absolute -left-[10%] bottom-[-55%] h-[90%] w-[120%] rounded-[50%]"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(232,137,43,0.09), rgba(232,137,43,0.04) 36%, transparent 70%)" }}
      />
    </div>
  );
}
