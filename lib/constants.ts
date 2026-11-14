import type { SeverityTier } from "@/lib/types";

/** Autumn Lantern & Enchanted Casebook theme palette. */
export const THEME = {
  moonlitMidnight: "#0D1117",
  agedParchment: "#F8F3E6",
  darkInk: "#1A1614",
  pumpkinOrange: "#FF5A1F",
  crimsonWax: "#DC2626",
  candlelightGold: "#D97706",
  potionEmerald: "#059669",
} as const;

/** Maximum characters accepted in the scanner input. */
export const INPUT_MAX_CHARS = 10_000;

/** Timeout for the AI interpretation request, in milliseconds. */
export const AI_TIMEOUT_MS = 30_000;

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
 * score does not conclusively prove fraud.
 */
export const SEVERITY_TIERS: ReadonlyArray<{
  readonly min: number;
  readonly max: number;
  readonly tier: SeverityTier;
  readonly color: string;
}> = [
  { min: 70, max: 100, tier: "TRAP DETECTED", color: "#DC2626" },
  { min: 40, max: 69, tier: "Caution — verify before acting", color: "#D97706" },
  { min: 0, max: 39, tier: "Low risk — still verify independently", color: "#059669" },
];

export const ADVISORY_DISCLAIMER =
  "Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice. Always verify independently.";

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
