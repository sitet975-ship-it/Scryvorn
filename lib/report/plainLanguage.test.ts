import { describe, expect, it } from "vitest";
import scamTriggers from "@/data/scamTriggers.json";
import type { AiFinding } from "@/lib/ai/types";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import type { DeterministicFinding } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import { SAMPLE_TRAPS } from "@/lib/samples/sampleTraps";
import type { CompleteScanResult } from "@/lib/types";
import {
  AI_NO_FINDINGS_SUMMARY,
  FINDING_WORDING,
  NO_RULE_FINDINGS_SUMMARY,
  aiSummary,
  explainFinding,
  ruleSummary,
} from "./plainLanguage";

const f = (category: string, weight: number, check: DeterministicFinding["check"] = "scam_triggers"): DeterministicFinding => ({
  id: `${category}:${weight}`, source: "deterministic", check, category, label: `${category} label`,
  evidence: "e", severity: weight > 0 ? "medium" : "info", weight,
});
const ai = (label: string): AiFinding => ({ id: label, source: "ai", category: "c", label, evidence: "e", severity: "low", weight: 8 });

function result(over: Partial<CompleteScanResult>): CompleteScanResult {
  return {
    timestamp: "2026-11-14T08:48:12Z", inputType: "message", deterministicStatus: "complete", incompleteChecks: [],
    riskScore: 0, severityTier: "Low risk — still verify independently", waxSealColor: "#15803D",
    deterministicFindings: [], aiFindings: [], recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
    aiAvailable: true, lookalikeCheckActive: false, domainAgeAvailable: false, disclaimer: ADVISORY_DISCLAIMER, ...over,
  };
}

describe("plain-English wording", () => {
  it("covers every scam-trigger category and every scored link category the engine produces", () => {
    for (const c of scamTriggers.categories) expect(FINDING_WORDING, c.id).toHaveProperty(c.id);
    for (const c of ["shortener", "lookalike", "domain_age"]) expect(FINDING_WORDING, c).toHaveProperty(c);
  });

  it("never calls anything safe, legitimate, or fraudulent, and never claims certainty", () => {
    const all = [NO_RULE_FINDINGS_SUMMARY, AI_NO_FINDINGS_SUMMARY, ...Object.values(FINDING_WORDING).flatMap((w) => [w.phrase, w.explanation])];
    for (const s of all) {
      expect(s, s).not.toMatch(/\bsafe\b|legitimate|fraudulent|\bdefinitely\b|\bcertainly\b|\bproven\b|\bguarantee/i);
    }
  });

  it("explains only scored findings with reviewed wording", () => {
    expect(explainFinding(f("upfront_payment", 12))).toBe(FINDING_WORDING.upfront_payment.explanation);
    expect(explainFinding(f("https_status", 0, "https_status"))).toBeNull(); // informational
    expect(explainFinding(f("elevated_attention_tld", 0, "domain_heuristic"))).toBeNull();
    expect(explainFinding(f("domain_age", 0, "domain_age"))).toBeNull(); // old domain: not scored
    expect(explainFinding(f("domain_age", 10, "domain_age"))).toBe(FINDING_WORDING.domain_age.explanation);
    expect(explainFinding(f("made_up_category", 12))).toBeNull(); // no invented wording
  });
});

describe("ruleSummary", () => {
  it("summarizes only the categories actually found, once each", () => {
    const s = ruleSummary(result({ deterministicFindings: [f("urgency_pressure", 12), f("upfront_payment", 12), f("https_status", 0, "https_status")] }));
    expect(s).toBe(
      "Scryvorn found patterns that can appear in scams. This message includes pressure to act quickly and a request to pay up front. Pause before acting and verify through an official channel.",
    );
  });

  it("uses the no-findings wording when nothing scored", () => {
    expect(ruleSummary(result({ deterministicFindings: [f("https_status", 0, "https_status")] }))).toBe(NO_RULE_FINDINGS_SUMMARY);
  });

  it("matches the real deterministic output for the Fake Remote Job DM sample", async () => {
    const det = await runDeterministicChecks(SAMPLE_TRAPS[0].content);
    expect(ruleSummary(result({ deterministicFindings: det.findings }))).toBe(
      "Scryvorn found patterns that can appear in scams. This message includes a request to pay up front, pressure to act quickly, a push to continue the conversation on another app, and job-offer wording that often appears in scams. Pause before acting and verify through an official channel.",
    );
  });
});

describe("aiSummary", () => {
  it("keeps the exact unavailable notices and never implies AI ran", () => {
    expect(aiSummary(result({ aiAvailable: false, aiUnavailableReason: "timeout" }))).toBe(
      "AI analysis unavailable (the AI service did not respond in time).",
    );
    expect(aiSummary(result({ aiAvailable: false, aiUnavailableReason: "error", aiFindings: [ai("ignored")] }))).toBe(
      "AI analysis unavailable (the AI service returned an error or an unusable response).",
    );
  });

  it("states no AI findings without implying the message is genuine", () => {
    expect(aiSummary(result({}))).toBe(AI_NO_FINDINGS_SUMMARY);
  });

  it("uses only the AI findings' own labels, defanged", () => {
    expect(aiSummary(result({ aiFindings: [ai("Asks for a code.")] }))).toBe(
      "The model pointed to one pattern: Asks for a code. These are model interpretations, not verified facts.",
    );
    const s = aiSummary(result({ aiFindings: [ai("A"), ai("B"), ai("Visit https://x.example"), ai("D")] }));
    expect(s).toBe("The model pointed to 4 patterns: A; B; Visit hxxps://x[.]example; and 1 more. These are model interpretations, not verified facts.");
  });
});
