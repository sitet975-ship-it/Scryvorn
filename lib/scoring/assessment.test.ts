import { describe, expect, it } from "vitest";
import type { AiFinding, AiOutcome } from "@/lib/ai/types";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import type { DeterministicFinding, DeterministicResult } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import { assessScan } from "./assessment";

const shortener: DeterministicFinding = {
  id: "shortener:https://bit.ly/x",
  source: "deterministic",
  check: "shortener",
  category: "shortener",
  label: "URL shortener",
  evidence: "synthetic",
  url: "https://bit.ly/x",
  severity: "low",
  weight: 15,
};

const aiHigh: AiFinding = {
  id: "ai:0",
  source: "ai",
  category: "credential_request",
  label: "Asks for a code",
  evidence: "synthetic",
  severity: "high",
  weight: 25,
};

function detResult(over: Partial<DeterministicResult> = {}): DeterministicResult {
  return {
    findings: [shortener],
    status: "complete",
    incompleteChecks: [],
    domainAgeAvailable: false,
    lookalikeCheckActive: false,
    ...over,
  };
}

const AI_OK: AiOutcome = {
  unavailable: false,
  findings: [aiHigh],
  recommendedSteps: ["Call the bank using the number on your card."],
};

describe("assessScan: complete deterministic runs", () => {
  it("scores deterministic and AI findings and derives the tier", () => {
    const a = assessScan(detResult(), AI_OK);
    expect(a.deterministicStatus).toBe("complete");
    expect(a.incompleteChecks).toEqual([]);
    expect(a.riskScore).toBe(40);
    expect(a.severityTier).toBe("Caution — verify before acting");
    expect(a.waxSealColor).toBe("#E8892B"); // Caution tier color (approved palette)
    expect(a.aiAvailable).toBe(true);
    expect(a.aiFindings).toEqual([aiHigh]);
    expect(a.recommendedSteps).toEqual(AI_OK.unavailable ? [] : AI_OK.recommendedSteps);
    expect(a.disclaimer).toBe(ADVISORY_DISCLAIMER);
    expect("aiUnavailableReason" in a).toBe(false);
  });

  it("scores deterministic findings alone when AI is unavailable, with fallback steps", () => {
    for (const reason of ["timeout", "error"] as const) {
      const a = assessScan(detResult(), { unavailable: true, reason });
      expect(a.riskScore).toBe(15);
      expect(a.severityTier).toBe("Low risk — still verify independently");
      expect(a.aiAvailable).toBe(false);
      expect(a.aiUnavailableReason).toBe(reason);
      expect(a.aiFindings).toEqual([]);
      expect(a.recommendedSteps).toEqual([...FALLBACK_VERIFICATION_STEPS]);
    }
  });

  it("uses fallback steps when AI returns no steps", () => {
    const a = assessScan(detResult(), { unavailable: false, findings: [], recommendedSteps: [] });
    expect(a.recommendedSteps).toEqual([...FALLBACK_VERIFICATION_STEPS]);
    expect(a.aiAvailable).toBe(true);
  });

  it("carries lookalikeCheckActive and domainAgeAvailable", () => {
    const a = assessScan(detResult({ lookalikeCheckActive: true, domainAgeAvailable: true }), AI_OK);
    expect(a.lookalikeCheckActive).toBe(true);
    expect(a.domainAgeAvailable).toBe(true);
  });

  it("works with a real deterministic run (no network, no AI)", async () => {
    const det = await runDeterministicChecks("Your statement is ready. https://examplebank.test/s");
    const a = assessScan(det, { unavailable: true, reason: "error" });
    expect(a.deterministicStatus).toBe("complete");
    expect(a.riskScore).toBe(0);
    expect(a.severityTier).toBe("Low risk — still verify independently");
    expect(a.lookalikeCheckActive).toBe(false);
  });
});

describe("assessScan: incomplete deterministic runs", () => {
  it("assigns no score, tier, or color and keeps the evidence", () => {
    const det = detResult({ status: "incomplete", incompleteChecks: ["scam_triggers"] });
    const a = assessScan(det, AI_OK);
    expect(a.deterministicStatus).toBe("incomplete");
    expect(a.incompleteChecks).toEqual(["scam_triggers"]);
    expect(a.riskScore).toBeNull();
    expect(a.severityTier).toBeNull();
    expect(a.waxSealColor).toBeNull();
    expect(a.deterministicFindings).toEqual([shortener]);
    expect(a.aiFindings).toEqual([aiHigh]);
  });

  it("does not substitute a higher tier even when the partial evidence is strong", () => {
    const strong = Array.from({ length: 7 }, (_, i) => ({ ...shortener, id: `s${i}` }));
    const det = detResult({ findings: strong, status: "incomplete", incompleteChecks: ["scam_triggers"] });
    const a = assessScan(det, AI_OK);
    expect(a.riskScore).toBeNull();
    expect(a.severityTier).toBeNull();
  });

  it("treats an inconsistent result (complete status with unfinished checks) as incomplete", () => {
    const det = detResult({ incompleteChecks: ["domain_heuristic"] });
    const a = assessScan(det, AI_OK);
    expect(a.deterministicStatus).toBe("incomplete");
    expect(a.riskScore).toBeNull();
  });

  it("does not mutate its inputs", () => {
    const det = detResult({ status: "incomplete", incompleteChecks: ["scam_triggers"] });
    const before = JSON.stringify([det, AI_OK]);
    const a = assessScan(det, AI_OK);
    a.deterministicFindings.push(shortener);
    if (a.deterministicStatus === "incomplete") a.incompleteChecks.push("shortener");
    expect(JSON.stringify([det, AI_OK])).toBe(before);
  });
});
