/**
 * Deterministic pseudo-random numbers (mulberry32) for procedural artwork
 * such as tarantula hair. Seeded so server and client render identical SVG
 * (no hydration mismatch) and screenshots are reproducible.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rounds to two decimals to keep path strings short and stable. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Shared attributes for every decorative SVG. */
export const DECORATIVE_SVG = {
  "aria-hidden": true,
  focusable: "false",
  style: { pointerEvents: "none" },
} as const;
