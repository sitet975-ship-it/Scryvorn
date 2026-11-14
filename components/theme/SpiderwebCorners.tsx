/**
 * Decorative geometric spiderweb accents for the four corners of a card.
 *
 * Purely decorative: aria-hidden, not focusable, and pointer-events: none, so
 * it never intercepts clicks or reaches assistive technology. The parent must
 * be positioned (for example `relative`). Whether the webs avoid the input and
 * results areas can only be checked once the scanner card is composed (Task 9).
 */
export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const SPIDERWEB_CORNERS: readonly Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

const PLACEMENT: Record<Corner, { className: string; transform?: string }> = {
  "top-left": { className: "left-0 top-0" },
  "top-right": { className: "right-0 top-0", transform: "scaleX(-1)" },
  "bottom-left": { className: "bottom-0 left-0", transform: "scaleY(-1)" },
  "bottom-right": { className: "bottom-0 right-0", transform: "scale(-1, -1)" },
};

/** Radial threads from the corner plus three concentric rings. */
const WEB_PATH = [
  "M0 0L72 0", "M0 0L68 28", "M0 0L52 52", "M0 0L28 68", "M0 0L0 72",
  "M24 0L23 9L17 17L9 23L0 24",
  "M46 0L44 18L33 33L18 44L0 46",
  "M68 0L65 27L50 50L27 65L0 68",
].join(" ");

export function SpiderwebCorners() {
  return (
    <div
      aria-hidden="true"
      data-decorative="spiderweb"
      className="absolute inset-0 overflow-hidden text-dark-ink"
      style={{ pointerEvents: "none" }}
    >
      {SPIDERWEB_CORNERS.map((corner) => (
        <svg
          key={corner}
          aria-hidden="true"
          focusable="false"
          data-corner={corner}
          className={`absolute h-16 w-16 sm:h-20 sm:w-20 ${PLACEMENT[corner].className}`}
          style={{ opacity: 0.18, pointerEvents: "none", transform: PLACEMENT[corner].transform }}
          viewBox="0 0 72 72"
          fill="none"
        >
          <path d={WEB_PATH} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}
