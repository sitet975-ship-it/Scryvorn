import { DECORATIVE_SVG } from "./seeded";

const LEFT_WING =
  "M50 32 C46 24 40 21 35 25 C30 17 19 14 5 19 C13 22 17 28 17 35 C23 31 29 33 31 39 C35 35 41 35 45 41 Z";
const RIGHT_WING =
  "M50 32 C54 24 60 21 65 25 C70 17 81 14 95 19 C87 22 83 28 83 35 C77 31 71 33 69 39 C65 35 59 35 55 41 Z";

/**
 * Bat silhouette with flapping wings. `flap` sets this bat's own wingbeat
 * (CSS variable --flap), so bats do not flap in unison. A thin ember stroke
 * separates the black silhouette from the dark cathedral; there is no CSS
 * filter.
 *
 * Two layers: the wings are their own SVG, and the wingbeat is a CSS
 * transform on that element (not inside the SVG), so the browser can animate
 * it without re-laying-out and repainting the bat every frame. The body sits
 * on top as a static SVG.
 */
export function Bat({
  width,
  opacity = 1,
  flap = "0.9s",
  className = "",
}: {
  width: number;
  opacity?: number;
  flap?: string;
  className?: string;
}) {
  return (
    <span
      data-decorative="bat"
      aria-hidden="true"
      className={`pointer-events-none relative inline-block align-top ${className}`}
      style={{ width, height: width * 0.5, opacity, ["--flap" as string]: flap }}
    >
      {/* The wingbeat animates this HTML wrapper: browsers only run CSS animations off the main thread on HTML elements, not SVG ones. */}
      <span className="scry-wing absolute inset-0 block">
        <svg {...DECORATIVE_SVG} viewBox="0 0 100 50" className="h-full w-full">
          <path d={LEFT_WING} fill="#07060A" stroke="#9A5A30" strokeWidth="1.4" />
          <path d={RIGHT_WING} fill="#07060A" stroke="#9A5A30" strokeWidth="1.4" />
        </svg>
      </span>
      <svg {...DECORATIVE_SVG} viewBox="0 0 100 50" className="absolute inset-0 h-full w-full">
        {/* Body and ears. */}
        <path d="M46 30 Q50 46 54 30 Q53 24 50 24 Q47 24 46 30Z M46.5 25 L45.5 19 L48.5 23.5Z M53.5 25 L54.5 19 L51.5 23.5Z" fill="#07060A" stroke="#9A5A30" strokeWidth="0.8" />
        <circle cx="48.6" cy="27" r="0.9" fill="#E8892B" />
        <circle cx="51.4" cy="27" r="0.9" fill="#E8892B" />
      </svg>
    </span>
  );
}

/**
 * Each bat has its own flight: direction (left-to-right or right-to-left),
 * path shape (wave, dip, climb, glide, or circling hover), altitude, speed,
 * start offset, and wingbeat. The keyframes are in app/globals.css
 * (scry-bat-1 .. scry-bat-6).
 */
export const BAT_FLIGHTS = [
  { cls: "scry-bat-1", top: "22%", width: 54, opacity: 1, flap: "1.1s" }, // left to right, wave
  { cls: "scry-bat-2", top: "46%", width: 38, opacity: 0.9, flap: "0.95s" }, // right to left, dip
  { cls: "scry-bat-3", top: "8%", width: 30, opacity: 0.85, flap: "0.9s" }, // left to right, climb
  { cls: "scry-bat-4", top: "68%", width: 44, opacity: 0.95, flap: "1.3s" }, // right to left, rise
  { cls: "scry-bat-5", top: "30%", width: 26, opacity: 0.8, flap: "1s" }, // circling hover by the left window
  { cls: "scry-bat-6", top: "58%", width: 34, opacity: 0.85, flap: "1.2s" }, // left to right, steep glide
] as const;

/** Bats crossing the upper cathedral, each on an independent flight path. */
export function Bats({ className = "" }: { className?: string }) {
  return (
    <div data-decorative="bats" aria-hidden="true" className={`pointer-events-none absolute inset-x-0 overflow-hidden ${className}`}>
      {BAT_FLIGHTS.map((b) => (
        <div key={b.cls} data-bat-flight={b.cls} className={`${b.cls} absolute left-0`} style={{ top: b.top }}>
          <Bat width={b.width} opacity={b.opacity} flap={b.flap} />
        </div>
      ))}
    </div>
  );
}
