import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import type { AiOutcome } from "@/lib/ai/types";
import type { DeterministicResult } from "@/lib/checks/types";
import type { ScanResult } from "@/lib/types";
import { computeRiskScore, severityTierForScore } from "./riskScore";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Everything in a ScanResult except the fields the route supplies. */
export type ScanAssessment = DistributiveOmit<ScanResult, "timestamp" | "inputType">;

/**
 * The single shared completion rule (Req 6.9). Route and UI code must use this
 * instead of rebuilding it.
 *
 * - Complete only if det.status is "complete" AND det.incompleteChecks is
 *   empty; then score and tier come from computeRiskScore/severityTierForScore.
 * - Otherwise incomplete: riskScore, severityTier, and waxSealColor are null,
 *   unfinished checks are listed, and all collected findings are kept. No
 *   higher tier is substituted and no score is manufactured.
 * - AI unavailable: aiFindings is [] and the score uses deterministic findings
 *   alone (Req 6.8).
 * - recommendedSteps: the AI's steps if AI is available and returned any,
 *   otherwise FALLBACK_VERIFICATION_STEPS.
 *
 * Pure. Inputs are not mutated; arrays are copied.
 */
export function assessScan(det: DeterministicResult, ai: AiOutcome): ScanAssessment {
  const aiAvailable = !ai.unavailable;
  const aiFindings = ai.unavailable ? [] : [...ai.findings];
  const recommendedSteps =
    !ai.unavailable && ai.recommendedSteps.length > 0
      ? [...ai.recommendedSteps]
      : [...FALLBACK_VERIFICATION_STEPS];

  const common = {
    deterministicFindings: [...det.findings],
    aiFindings,
    recommendedSteps,
    aiAvailable,
    ...(ai.unavailable ? { aiUnavailableReason: ai.reason } : {}),
    lookalikeCheckActive: det.lookalikeCheckActive,
    domainAgeAvailable: det.domainAgeAvailable,
    disclaimer: ADVISORY_DISCLAIMER,
  };

  if (det.status !== "complete" || det.incompleteChecks.length > 0) {
    return {
      ...common,
      deterministicStatus: "incomplete",
      incompleteChecks: [...det.incompleteChecks],
      riskScore: null,
      severityTier: null,
      waxSealColor: null,
    };
  }

  const riskScore = computeRiskScore(det.findings, aiFindings);
  const { tier, color } = severityTierForScore(riskScore);
  return {
    ...common,
    deterministicStatus: "complete",
    incompleteChecks: [],
    riskScore,
    severityTier: tier,
    waxSealColor: color,
  };
}
