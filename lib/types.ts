import type { DeterministicFinding } from "@/lib/checks/types";
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

export interface ScanResult {
  /** ISO 8601 scan timestamp. */
  timestamp: string;
  /** Derived from whether URLs were found in the input. */
  inputType: InputType;
  /**
   * 0..100 integer, a pure function of the findings. A low score never
   * guarantees safety; a high score does not conclusively prove fraud.
   */
  riskScore: number;
  severityTier: SeverityTier;
  /** Hex color for the wax seal. */
  waxSealColor: string;
  deterministicFindings: DeterministicFinding[];
  aiFindings: AiFinding[];
  recommendedSteps: string[];
  aiAvailable: boolean;
  aiUnavailableReason?: "timeout" | "error";
  /** Advisory disclaimer text. */
  disclaimer: string;
}
