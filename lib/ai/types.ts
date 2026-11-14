/**
 * Types for the AI interpretation layer. Types only: no runtime logic.
 */

export interface AiFinding {
  id: string;
  source: "ai";
  category: string;
  label: string;
  evidence: string;
  /** Based on model confidence. */
  severity: "low" | "medium" | "high";
  /** Mapped from severity for scoring. */
  weight: number;
}

export type AiOutcome =
  | { unavailable: true; reason: "timeout" | "error" }
  | { unavailable: false; findings: AiFinding[]; recommendedSteps: string[] };
