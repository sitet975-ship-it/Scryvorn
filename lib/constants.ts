import type { SeverityTier } from "@/lib/types";

/**
 * Haunted forensic laboratory palette (approved Halloween redesign).
 * Crimson: danger and verdicts. Amber: atmosphere, investigation, active
 * states. Green: laboratory energy and AI interpretation.
 */
export const THEME = {
  background: "#070709",
  card: "#110D0F",
  border: "rgba(155,38,38,0.28)",
  crimson: "#9B2626",
  amber: "#E8892B",
  labGreen: "#4ADE80",
  labGreenDeep: "#2F8F5B",
  ivory: "#EAE2D6",
  muted: "#A79F94",
  danger: "#B91C1C",
  success: "#15803D",
} as const;

/** Maximum characters accepted in the scanner input. */
export const INPUT_MAX_CHARS = 10_000;

/** Timeout for the AI interpretation request, in milliseconds. */
export const AI_TIMEOUT_MS = 30_000;

/**
 * Browser-side timeout for POST /api/scan, in milliseconds. Above
 * AI_TIMEOUT_MS and below Netlify's 60-second synchronous function limit.
 * An aborted request is treated as a retryable error.
 */
export const SCAN_CLIENT_TIMEOUT_MS = 45_000;

/**
 * Tunable risk weights. The Risk_Score is a pure function of findings.
 * Informational findings carry weight 0 and never add risk.
 */
export const SCORING_WEIGHTS = {
  deterministic: {
    shortener: 15,
    /** Informational context only; never adds risk. */
    elevated_attention_tld: 0,
    lookalike_high: 20,
    lookalike_low: 10,
    scam_trigger_each: 12,
    /** Caps the total scam-trigger contribution. */
    scam_trigger_max_total: 36,
    /** Domains younger than this many days add risk. */
    domain_age_young_days: 90,
    domain_age_young: 10,
    /** Informational only. */
    https_status: 0,
    /** Informational note only. */
    domain_age_unavailable: 0,
  },
  ai: { high: 25, medium: 15, low: 8 },
} as const;

/**
 * Severity tiers derived strictly from the Risk_Score.
 * Tiers are advisory: a low score never guarantees safety, and a high
 * score does not conclusively prove fraud. Colors are used for rings and
 * accents only; tier text is always rendered in a light, readable color.
 */
export const SEVERITY_TIERS: ReadonlyArray<{
  readonly min: number;
  readonly max: number;
  readonly tier: SeverityTier;
  readonly color: string;
}> = [
  { min: 70, max: 100, tier: "TRAP DETECTED", color: "#B91C1C" },
  { min: 40, max: 69, tier: "Caution — verify before acting", color: "#E8892B" },
  { min: 0, max: 39, tier: "Low risk — still verify independently", color: "#15803D" },
];

export const ADVISORY_DISCLAIMER =
  "Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice. Always verify independently.";

/**
 * Caps for the deterministic summary passed to the AI prompt (approved values).
 * The summary is user-derived and untrusted; the caps bound its size.
 */
/** Maximum number of finding lines in the summary. */
export const DETERMINISTIC_SUMMARY_MAX_FINDINGS = 20;
/** Maximum characters per summary line, including the status line. */
export const DETERMINISTIC_SUMMARY_MAX_LINE_CHARS = 200;
/** Maximum characters in the whole summary, including line breaks. */
export const DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS = 3000;

/**
 * Reviewed fallback verification steps, used when AI is unavailable or
 * returns no steps. These are recommendations for the user to carry out,
 * not checks Scryvorn performed.
 */
export const FALLBACK_VERIFICATION_STEPS: readonly string[] = Object.freeze([
  "Verify the sender through an independently obtained contact method.",
  "Open the organization's official app or independently locate its official website instead of using the submitted link.",
  "Do not share passwords, one-time codes, or recovery phrases.",
  "Pause before sending money or acting on urgent requests.",
]);
