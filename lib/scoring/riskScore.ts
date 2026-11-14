import { SCORING_WEIGHTS, SEVERITY_TIERS } from "@/lib/constants";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import type { SeverityTier } from "@/lib/types";

/**
 * Risk scoring (pure).
 *
 * INTERNAL CONTRACT: these functions trust the `weight` on each finding. The
 * weights are assigned by the trusted internal producers (deterministic checks
 * and the AI engine) from SCORING_WEIGHTS. This is not an API for accepting
 * client-supplied findings or weights; the scan route must generate its own
 * findings server-side.
 *
 * The Risk_Score is an UNCALIBRATED HEURISTIC, not a probability, a verified
 * fraud verdict, or a validated confidence estimate. For this milestone:
 *  - Only deterministic findings with check "scam_triggers" are capped
 *    (scam_trigger_max_total). AI category strings are never capped.
 *  - All other deterministic contributions are additive (e.g. repeated
 *    distinct shortened URLs accumulate).
 *  - AI contributions are additive; AI findings alone can reach the top tier.
 *  - Overlap between engines (same category from both) is not deduplicated.
 */

/** Thrown when a finding carries a non-finite or negative weight. */
export class InvalidFindingWeightError extends RangeError {
  constructor() {
    super("Finding weight must be a finite, non-negative number.");
    this.name = "InvalidFindingWeightError";
  }
}

function checkedWeight(weight: unknown): number {
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
    throw new InvalidFindingWeightError();
  }
  return weight;
}

/**
 * Sums finding weights, caps the deterministic scam-trigger total, clamps to
 * [0, 100], and rounds. Identical findings always yield an identical score.
 * Throws InvalidFindingWeightError for any invalid weight.
 */
export function computeRiskScore(
  det: readonly DeterministicFinding[],
  ai: readonly AiFinding[],
): number {
  let scamTriggerTotal = 0;
  let additive = 0;

  for (const f of det) {
    const w = checkedWeight(f.weight);
    if (f.check === "scam_triggers") scamTriggerTotal += w;
    else additive += w;
  }
  for (const f of ai) additive += checkedWeight(f.weight);

  const capped = Math.min(
    scamTriggerTotal,
    SCORING_WEIGHTS.deterministic.scam_trigger_max_total,
  );
  return Math.round(Math.min(100, Math.max(0, additive + capped)));
}

/**
 * Maps an integer score in [0, 100] to its Severity_Tier and wax-seal color.
 * The tier is derived strictly from the score. Throws RangeError otherwise.
 */
export function severityTierForScore(score: number): { tier: SeverityTier; color: string } {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new RangeError("Risk score must be an integer from 0 to 100.");
  }
  const t = SEVERITY_TIERS.find((s) => s.min <= score && score <= s.max);
  if (!t) throw new RangeError("Risk score must be an integer from 0 to 100.");
  return { tier: t.tier, color: t.color };
}
