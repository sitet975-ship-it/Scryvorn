import { describe, expect, it, vi } from "vitest";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import type { CompleteScanResult, IncompleteScanResult, ScanResult } from "@/lib/types";
import {
  AI_UNAVAILABLE_NOTICE,
  INCOMPLETE_ASSESSMENT_NOTICE,
  InvalidTimestampError,
  LOOKALIKE_CONFIGURED_NOTICE,
  LOOKALIKE_INACTIVE_NOTICE,
  REPORT_SECTIONS,
  STEPS_ARE_RECOMMENDATIONS_NOTICE,
  buildEvidenceReport,
  reportFilename,
} from "./evidenceReport";
import { toSafeMarkdownText as md } from "./safeMarkdown";

function f(over: Partial<DeterministicFinding> & Pick<DeterministicFinding, "check" | "category" | "weight">): DeterministicFinding {
  return {
    id: `${over.category}:x`,
    source: "deterministic",
    label: `${over.category} label`,
    evidence: `${over.category} evidence`,
    severity: over.weight > 0 ? "low" : "info",
    ...over,
  };
}

const HTTPS = f({ check: "https_status", category: "https_status", weight: 0, label: "HTTPS status", evidence: "Uses HTTPS" });
const TLD = f({ check: "domain_heuristic", category: "elevated_attention_tld", weight: 0, label: "Elevated-attention TLD", evidence: "TLD context" });
const SHORT = f({ check: "shortener", category: "shortener", weight: 15, label: "URL shortener", evidence: "Hidden destination" });
const TRIGGER = f({ check: "scam_triggers", category: "urgency_pressure", weight: 12, label: "urgency pressure", evidence: "Matched act now", matchedText: "act now" });
const AGE_NOTE = f({ check: "domain_age", category: "domain_age_unavailable", weight: 0, label: "Domain registration age unavailable", evidence: "No age data" });

const AI_FINDING: AiFinding = {
  id: "ai:0",
  source: "ai",
  category: "credential_request",
  label: "Asks for a code",
  evidence: "Quotes the code request",
  severity: "high",
  weight: 25,
};

function complete(over: Partial<CompleteScanResult> = {}): CompleteScanResult {
  return {
    timestamp: "2026-11-14T08:48:12Z",
    inputType: "mixed",
    deterministicStatus: "complete",
    incompleteChecks: [],
    riskScore: 52,
    severityTier: "Caution — verify before acting",
    waxSealColor: "#D97706",
    deterministicFindings: [HTTPS, SHORT, TLD, TRIGGER, AGE_NOTE],
    aiFindings: [AI_FINDING],
    recommendedSteps: ["Call the bank using the number on your card."],
    aiAvailable: true,
    lookalikeCheckActive: false,
    domainAgeAvailable: false,
    disclaimer: ADVISORY_DISCLAIMER,
    ...over,
  };
}

function incomplete(over: Partial<IncompleteScanResult> = {}): IncompleteScanResult {
  return {
    ...complete(),
    deterministicStatus: "incomplete",
    incompleteChecks: ["scam_triggers"],
    riskScore: null,
    severityTier: null,
    waxSealColor: null,
    deterministicFindings: [HTTPS, SHORT],
    ...over,
  };
}

/** Text of one "## " section, without its heading. */
function section(report: string, name: string): string {
  const start = report.indexOf(`## ${name}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = report.slice(start + name.length + 4);
  const next = rest.indexOf("\n## ");
  return next === -1 ? rest : rest.slice(0, next);
}

/** True if any `ch` is preceded by an even number (including zero) of backslashes. */
function hasUnescaped(text: string, ch: string): boolean {
  for (let i = text.indexOf(ch); i !== -1; i = text.indexOf(ch, i + 1)) {
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) backslashes++;
    if (backslashes % 2 === 0) return true;
  }
  return false;
}

/** Removes the report's own "not proof of safety" phrases, then checks for safety claims. */
function expectNoSafetyClaim(report: string) {
  expect(report).not.toMatch(/verified safe/i);
  const stripped = report
    .replaceAll("This is not proof that the message is safe.", "")
    .replaceAll("not evidence that a link is safe or fraudulent", "");
  expect(stripped).not.toMatch(/\bsafe\b/i);
}

describe("structure", () => {
  it("uses the seven sections in order and no 'Verified Checks' heading", () => {
    const report = buildEvidenceReport(complete());
    const headings = report.split("\n").filter((l) => l.startsWith("## ")).map((l) => l.slice(3));
    expect(headings).toEqual([...REPORT_SECTIONS]);
    expect(report).not.toMatch(/verified checks/i);
    expect(report.startsWith("# Scryvorn Evidence Report\n")).toBe(true);
  });

  it("makes no safety claims", () => {
    expectNoSafetyClaim(buildEvidenceReport(complete()));
    expectNoSafetyClaim(buildEvidenceReport(incomplete()));
    expectNoSafetyClaim(
      buildEvidenceReport(complete({ deterministicFindings: [], aiFindings: [], riskScore: 0, severityTier: "Low risk — still verify independently" })),
    );
  });

  it("ends with the advisory disclaimer", () => {
    const report = buildEvidenceReport(complete());
    expect(section(report, "Advisory disclaimer")).toContain(md(ADVISORY_DISCLAIMER));
  });
});

describe("complete assessment", () => {
  const report = buildEvidenceReport(complete());

  it("shows the UTC time, input type, score as an uncalibrated heuristic, and tier", () => {
    const status = section(report, "Assessment status and coverage");
    expect(status).toContain("- Scan time: 2026-11-14 08:48:12 UTC");
    expect(status).toContain("- Input type: mixed");
    expect(status).toContain("- Deterministic checks: complete");
    expect(status).toContain("52 / 100 (uncalibrated heuristic score; not a probability, a fraud verdict, or a validated confidence estimate)");
    expect(status).toContain("- Severity tier: Caution — verify before acting");
  });

  it("puts weighted findings under scored, HTTPS/TLD under informational, and domain age under unavailable", () => {
    const scored = section(report, "Scored deterministic findings");
    const info = section(report, "Informational context");
    const missing = section(report, "Checks not performed / unavailable");

    expect(scored).toContain("URL shortener");
    expect(scored).toContain("urgency pressure");
    expect(scored).toContain("Matched text: act now");
    expect(scored).not.toContain("HTTPS status");

    expect(info).toContain("HTTPS status");
    expect(info).toContain("Elevated\\-attention TLD");
    expect(info).not.toContain("URL shortener");
    expect(info).not.toContain("Domain registration age unavailable");

    expect(missing).toContain("Domain registration age unavailable");
  });

  it("says when there are no scored findings without implying safety", () => {
    const r = buildEvidenceReport(complete({ deterministicFindings: [HTTPS] }));
    expect(section(r, "Scored deterministic findings")).toContain(
      "No scored deterministic findings were produced. This is not proof that the message is safe.",
    );
  });
});

describe("lookalike coverage", () => {
  it("states the exact inactive sentence when no list is configured", () => {
    const report = buildEvidenceReport(complete({ lookalikeCheckActive: false }));
    expect(LOOKALIKE_INACTIVE_NOTICE).toBe(
      "Lookalike checking was not performed because no reviewed reference list is configured. This is not a passed check.",
    );
    expect(section(report, "Assessment status and coverage")).toContain(LOOKALIKE_INACTIVE_NOTICE);
    expect(section(report, "Checks not performed / unavailable")).toContain(LOOKALIKE_INACTIVE_NOTICE);
  });

  it("describes an active list as configured, not as proof it ran", () => {
    const report = buildEvidenceReport(complete({ lookalikeCheckActive: true }));
    expect(report).toContain(LOOKALIKE_CONFIGURED_NOTICE);
    expect(report).not.toContain(LOOKALIKE_INACTIVE_NOTICE);
  });
});

describe("incomplete assessment", () => {
  const report = buildEvidenceReport(incomplete({ incompleteChecks: ["domain_heuristic", "scam_triggers"] }));

  it("states the incomplete notice and assigns no score or tier", () => {
    expect(INCOMPLETE_ASSESSMENT_NOTICE).toBe("Assessment incomplete — no overall risk score or tier assigned.");
    const status = section(report, "Assessment status and coverage");
    expect(status).toContain(INCOMPLETE_ASSESSMENT_NOTICE);
    expect(report).not.toContain("Overall risk score");
    expect(report).not.toContain("Severity tier");
    expect(report).not.toContain("/ 100");
    expect(report).not.toMatch(/Low risk|Caution — verify|TRAP DETECTED/);
  });

  it("lists the unfinished checks and keeps the collected evidence", () => {
    const status = section(report, "Assessment status and coverage");
    expect(status).toContain("  - Domain heuristics (elevated-attention TLD and lookalike)");
    expect(status).toContain("  - Scam-trigger phrase detection");
    expect(section(report, "Scored deterministic findings")).toContain("URL shortener");
    expect(section(report, "Informational context")).toContain("HTTPS status");
    const missing = section(report, "Checks not performed / unavailable");
    expect(missing).toContain("Scam-trigger phrase detection: did not finish because of an unexpected internal failure. A missing finding here is not a passed check.");
    expect(missing).toContain("Domain age: skipped because the required checks did not complete.");
  });
});

describe("AI interpretation", () => {
  it("shows 'AI analysis unavailable' and ignores inconsistent supplied AI findings and steps", () => {
    const report = buildEvidenceReport(
      complete({
        aiAvailable: false,
        aiUnavailableReason: "timeout",
        aiFindings: [{ ...AI_FINDING, label: "INCONSISTENT-AI-LABEL" }],
        recommendedSteps: ["INCONSISTENT-AI-STEP"],
      }),
    );
    expect(section(report, "AI interpretation")).toContain(AI_UNAVAILABLE_NOTICE);
    expect(section(report, "AI interpretation")).toContain("did not respond in time");
    expect(section(report, "Checks not performed / unavailable")).toContain(AI_UNAVAILABLE_NOTICE);
    expect(report).not.toContain("INCONSISTENT");
    for (const step of FALLBACK_VERIFICATION_STEPS) expect(report).toContain(md(step));
  });

  it("labels AI findings as model interpretation with confidence", () => {
    const ai = section(buildEvidenceReport(complete()), "AI interpretation");
    expect(ai).toContain("not verified facts or proof of fraud");
    expect(ai).toContain("**Asks for a code** (high confidence; category: credential\\_request)");
  });

  it("states no AI findings without implying safety", () => {
    const ai = section(buildEvidenceReport(complete({ aiFindings: [] })), "AI interpretation");
    expect(ai).toContain("The AI interpretation reported no findings. This is not proof that the message is safe.");
  });
});

describe("recommended verification steps", () => {
  it("labels steps as recommendations and disclaims visiting destinations", () => {
    const steps = section(buildEvidenceReport(complete()), "Recommended verification steps");
    expect(steps).toContain(STEPS_ARE_RECOMMENDATIONS_NOTICE);
    expect(STEPS_ARE_RECOMMENDATIONS_NOTICE).toContain("did not visit, open, or confirm any link or destination");
    expect(steps).toContain("Source: AI interpretation (model-generated; review before acting).");
    expect(steps).toContain("1. Call the bank using the number on your card\\.");
  });

  it("uses the reviewed fallback list when no steps are supplied", () => {
    const steps = section(buildEvidenceReport(complete({ recommendedSteps: [] })), "Recommended verification steps");
    expect(steps).toContain("Source: Scryvorn's standard verification guidance.");
    FALLBACK_VERIFICATION_STEPS.forEach((s, i) => expect(steps).toContain(`${i + 1}. ${md(s)}`));
  });
});

describe("safe Markdown output", () => {
  const evil = "[Click](https://evil.example/pay) ![x](http://evil.example/i.png) <script>alert(1)</script> \\<script>x</script> \\\\<img src=x> <https://evil.example> www.evil.example\n```\ncode\n```\n# fake heading";
  const result: ScanResult = complete({
    inputType: "url",
    deterministicFindings: [
      f({ check: "shortener", category: "shortener", weight: 15, label: evil, evidence: evil, url: "https://evil.example/pay", reference: evil }),
      f({ check: "scam_triggers", category: "urgency_pressure", weight: 12, matchedText: evil }),
    ],
    aiFindings: [{ ...AI_FINDING, label: evil, evidence: evil, category: evil }],
    recommendedSteps: [evil],
    disclaimer: evil,
  });

  it("emits no links, images, HTML, autolinks, fences, or live URLs from untrusted content", () => {
    const report = buildEvidenceReport(result);
    expect(report).not.toMatch(/\]\(/);
    expect(hasUnescaped(report, "<")).toBe(false);
    expect(hasUnescaped(report, "`")).toBe(false);
    expect(report).not.toContain("```");
    expect(report).not.toMatch(/https?:\/\//i);
    expect(report).not.toMatch(/www\./i);
    expect(report).toContain("hxxps://evil\\[\\.\\]example/pay");
    // Only the report's own headings start lines with '#'.
    const hashLines = report.split("\n").filter((l) => l.startsWith("#"));
    expect(hashLines).toEqual(["# Scryvorn Evidence Report", ...REPORT_SECTIONS.map((s) => `## ${s}`)]);
  });

  it("does not modify the findings in memory", () => {
    const before = JSON.stringify(result);
    buildEvidenceReport(result);
    expect(JSON.stringify(result)).toBe(before);
    expect(result.deterministicFindings[0].url).toBe("https://evil.example/pay");
  });
});

describe("timestamps and filenames", () => {
  it.each([
    ["2026-11-14T08:48:12Z", "scryvorn-report-20261114-084812.md"],
    ["2026-11-14T08:48:12.987Z", "scryvorn-report-20261114-084812.md"],
    ["2026-11-14T08:48:12z", "scryvorn-report-20261114-084812.md"],
    ["2026-11-14T10:48:12+02:00", "scryvorn-report-20261114-084812.md"],
    ["2026-11-14T14:18:12+0530", "scryvorn-report-20261114-084812.md"],
    ["2026-12-31T23:30:00-01:00", "scryvorn-report-20270101-003000.md"],
    ["2026-11-14T08:48Z", "scryvorn-report-20261114-084800.md"],
    ["2028-02-29T00:00:00Z", "scryvorn-report-20280229-000000.md"],
  ])("names %s as %s (UTC)", (ts, name) => {
    expect(reportFilename(ts)).toBe(name);
  });

  it("shows the converted UTC time in the report", () => {
    const r = buildEvidenceReport(complete({ timestamp: "2026-11-14T10:48:12+02:00" }));
    expect(r).toContain("- Scan time: 2026-11-14 08:48:12 UTC");
  });

  it.each([
    "",
    "2026-11-14T08:48:12",
    "2026-11-14",
    "2026-11-14 08:48:12Z",
    "not a date",
    "2026-02-29T00:00:00Z",
    "2026-02-30T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-11-14T24:00:00Z",
    "2026-11-14T08:60:00Z",
    "2026-11-14T08:48:12+25:00",
    "2026-11-14T08:48:12+02",
    "Sat, 14 Nov 2026 08:48:12 GMT",
  ])("rejects %j in both functions without echoing it", (ts) => {
    expect(() => reportFilename(ts)).toThrow(InvalidTimestampError);
    expect(() => buildEvidenceReport(complete({ timestamp: ts }))).toThrow(InvalidTimestampError);
    try {
      reportFilename(ts);
    } catch (e) {
      if (ts) expect((e as Error).message).not.toContain(ts);
    }
  });

  it("never substitutes the current time", () => {
    const now = vi.spyOn(Date, "now");
    expect(() => reportFilename("2026-11-14T08:48:12")).toThrow(InvalidTimestampError);
    reportFilename("2026-11-14T08:48:12Z");
    expect(now).not.toHaveBeenCalled();
    now.mockRestore();
  });
});
