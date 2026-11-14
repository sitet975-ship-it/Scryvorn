import type { CheckName, DeterministicFinding } from "@/lib/checks/types";
import type { AiFinding } from "@/lib/ai/types";

/**
 * Severity tier derived strictly from the Risk_Score.
 * A low score never guarantees safety, and a high score does not
 * conclusively prove fraud. Output is advisory only.
 */
export type SeverityTier =
  | "TRAP DETECTED"
  | "Caution — verify before acting"
  | "Low risk — still verify independently";

export type InputType = "message" | "url" | "mixed";

interface ScanResultBase {
  /** ISO 8601 scan timestamp with "Z" or a numeric offset. */
  timestamp: string;
  /** Derived from whether URLs were found in the input. */
  inputType: InputType;
  deterministicFindings: DeterministicFinding[];
  /** Always [] when `aiAvailable` is false. */
  aiFindings: AiFinding[];
  /** AI steps, or FALLBACK_VERIFICATION_STEPS. Recommendations only. */
  recommendedSteps: string[];
  aiAvailable: boolean;
  aiUnavailableReason?: "timeout" | "error";
  /** Configuration, not execution: a reference list was injected. */
  lookalikeCheckActive: boolean;
  domainAgeAvailable: boolean;
  /** Advisory disclaimer text. */
  disclaimer: string;
}

/** All required deterministic checks finished, so a score and tier exist. */
export interface CompleteScanResult extends ScanResultBase {
  deterministicStatus: "complete";
  incompleteChecks: [];
  /**
   * 0..100 integer, an uncalibrated heuristic computed from the findings.
   * Not a probability or a fraud verdict. A low score never guarantees
   * safety; a high score does not conclusively prove fraud.
   */
  riskScore: number;
  severityTier: SeverityTier;
  /** Hex color for the wax seal. */
  waxSealColor: string;
}

/**
 * Required deterministic checks were interrupted (Req 6.9). No score or tier
 * is assigned; collected evidence is kept.
 */
export interface IncompleteScanResult extends ScanResultBase {
  deterministicStatus: "incomplete";
  incompleteChecks: CheckName[];
  riskScore: null;
  severityTier: null;
  waxSealColor: null;
}

export type ScanResult = CompleteScanResult | IncompleteScanResult;
