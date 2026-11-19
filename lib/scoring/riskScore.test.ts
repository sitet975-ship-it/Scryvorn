import { describe, expect, it } from "vitest";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import { SCORING_WEIGHTS } from "@/lib/constants";
import {
  InvalidFindingWeightError,
  computeRiskScore,
  severityTierForScore,
} from "./riskScore";

const W = SCORING_WEIGHTS.deterministic;

function det(
  check: DeterministicFinding["check"],
  category: string,
  weight: number,
  id = `${category}:${Math.random()}`,
): DeterministicFinding {
  return {
    id,
    source: "deterministic",
    check,
    category,
    label: category,
    evidence: "synthetic",
    severity: weight > 0 ? "low" : "info",
    weight,
  };
}

function ai(severity: AiFinding["severity"], category = "credential_request"): AiFinding {
  return {
    id: `ai:${category}:${severity}`,
    source: "ai",
    category,
    label: category,
    evidence: "synthetic",
    severity,
    weight: SCORING_WEIGHTS.ai[severity],
  };
}

const trigger = (cat: string) => det("scam_triggers", cat, W.scam_trigger_each);
const shortener = (n: number) => det("shortener", "shortener", W.shortener, `short:${n}`);

describe("computeRiskScore", () => {
  it("is 0 with no findings", () => {
    expect(computeRiskScore([], [])).toBe(0);
  });

  it("ignores informational weight-0 findings", () => {
    const info = [
      det("https_status", "https_status", 0),
      det("domain_heuristic", "elevated_attention_tld", 0),
      det("domain_age", "domain_age_unavailable", 0),
    ];
    expect(computeRiskScore(info, [])).toBe(0);
  });

  it("caps deterministic scam-trigger findings at scam_trigger_max_total (60)", () => {
    expect(W.scam_trigger_max_total).toBe(60);
    const two = [trigger("a"), trigger("b")];
    const four = ["a", "b", "c", "d"].map(trigger);
    const seven = ["a", "b", "c", "d", "e", "f", "g"].map(trigger);
    expect(computeRiskScore(two, [])).toBe(24);
    expect(computeRiskScore(four, [])).toBe(48);
    expect(severityTierForScore(48).tier).toBe("Caution — verify before acting");
    expect(computeRiskScore(seven, [])).toBe(60);
    // Message rules alone never reach TRAP DETECTED.
    expect(severityTierForScore(60).tier).toBe("Caution — verify before acting");
  });

  it("does not apply the scam-trigger cap to AI findings, even with matching categories", () => {
    const aiFindings = ["upfront_payment", "urgency_pressure", "off_platform_move"].map((c) =>
      ai("medium", c),
    );
    expect(computeRiskScore([], aiFindings)).toBe(45);
    // Cap applies only to the deterministic part: 24 + 45.
    const two = ["a", "b"].map(trigger);
    expect(computeRiskScore(two, aiFindings)).toBe(69);
    const seven = ["a", "b", "c", "d", "e", "f", "g"].map(trigger);
    expect(computeRiskScore(seven, aiFindings)).toBe(100);
  });

  it("does not cap link-structure findings", () => {
    const link = det("url_structure", "ip_address_host", W.url_ip_address_host);
    const five = ["a", "b", "c", "d", "e"].map(trigger);
    expect(computeRiskScore([link, ...five], [])).toBe(25 + 60);
    expect(severityTierForScore(85).tier).toBe("TRAP DETECTED");
  });

  it("keeps other deterministic contributions additive: repeated shortened URLs reach TRAP", () => {
    const urls = [1, 2, 3, 4, 5].map(shortener);
    const score = computeRiskScore(urls, []);
    expect(score).toBe(75);
    expect(severityTierForScore(score).tier).toBe("TRAP DETECTED");
  });

  it("keeps AI contributions additive: AI findings alone reach TRAP", () => {
    const four = ["a", "b", "c", "d"].map((c) => ai("high", c));
    const score = computeRiskScore([], four);
    expect(score).toBe(100);
    expect(severityTierForScore(score).tier).toBe("TRAP DETECTED");
  });

  it("does not deduplicate overlap between engines", () => {
    const d = [trigger("credential_request")];
    const a = [ai("high", "credential_request")];
    expect(computeRiskScore(d, a)).toBe(12 + 25);
  });

  it("clamps to 100", () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map(shortener);
    expect(computeRiskScore(many, [])).toBe(100);
  });

  it("is deterministic", () => {
    const d = [trigger("a"), shortener(1), det("domain_age", "domain_age", W.domain_age_young)];
    const a = [ai("low")];
    expect(computeRiskScore(d, a)).toBe(computeRiskScore([...d], [...a]));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -0.5])(
    "rejects deterministic weight %s",
    (weight) => {
      expect(() => computeRiskScore([det("shortener", "shortener", weight)], [])).toThrow(
        InvalidFindingWeightError,
      );
    },
  );

  it("rejects an invalid AI weight, even alongside valid findings", () => {
    const bad = { ...ai("high"), weight: -25 };
    expect(() => computeRiskScore([shortener(1)], [bad])).toThrow(InvalidFindingWeightError);
    const nonNumber = { ...ai("high"), weight: "25" as unknown as number };
    expect(() => computeRiskScore([], [nonNumber])).toThrow(InvalidFindingWeightError);
  });

  it("is a RangeError with a message that echoes no values", () => {
    try {
      computeRiskScore([det("shortener", "shortener", Number.NaN)], []);
    } catch (e) {
      expect(e).toBeInstanceOf(RangeError);
      expect((e as Error).message).toBe("Finding weight must be a finite, non-negative number.");
    }
  });
});

describe("severityTierForScore", () => {
  it.each([
    // Approved Halloween palette tier colors (Req 6 revision).
    [0, "Low risk — still verify independently", "#15803D"],
    [39, "Low risk — still verify independently", "#15803D"],
    [40, "Caution — verify before acting", "#E8892B"],
    [69, "Caution — verify before acting", "#E8892B"],
    [70, "TRAP DETECTED", "#B91C1C"],
    [100, "TRAP DETECTED", "#B91C1C"],
  ])("maps %s to %s", (score, tier, color) => {
    expect(severityTierForScore(score)).toEqual({ tier, color });
  });

  it.each([-1, 101, 39.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (score) => {
    expect(() => severityTierForScore(score)).toThrow(RangeError);
  });
});
