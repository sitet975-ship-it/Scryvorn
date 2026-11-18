import { describe, expect, it } from "vitest";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER } from "@/lib/constants";
import type { CompleteScanResult, IncompleteScanResult } from "@/lib/types";
import { INCOMPLETE_ASSESSMENT_NOTICE, InvalidTimestampError, REPORT_SECTIONS, buildEvidenceReport } from "./evidenceReport";
import {
  buildPlainTextReport,
  buildReportDocument,
  markdownToReportLines,
  parseInline,
  renderPlainText,
  reportFilenameWithExtension,
  spansText,
} from "./reportDocument";

const TRIGGER: DeterministicFinding = {
  id: "scam_trigger:urgency_pressure",
  source: "deterministic",
  check: "scam_triggers",
  category: "urgency_pressure",
  label: "urgency pressure",
  evidence: 'Matched "act now" (see https://evil.example.com/pay?x=1).',
  matchedText: "act *now* #1 [link](x)",
  severity: "medium",
  weight: 12,
};
const AI: AiFinding = { id: "ai:0", source: "ai", category: "pressure", label: "Time **pressure**", evidence: "Says act now", severity: "high", weight: 25 };

const COMPLETE: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12Z",
  inputType: "mixed",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 37,
  severityTier: "Low risk — still verify independently",
  waxSealColor: "#15803D",
  deterministicFindings: [TRIGGER],
  aiFindings: [AI],
  recommendedSteps: ["Call the sender back using a number you already trust."],
  aiAvailable: true,
  lookalikeCheckActive: false,
  domainAgeAvailable: false,
  disclaimer: ADVISORY_DISCLAIMER,
};
const INCOMPLETE: IncompleteScanResult = {
  ...COMPLETE,
  deterministicStatus: "incomplete",
  incompleteChecks: ["scam_triggers"],
  riskScore: null,
  severityTier: null,
  waxSealColor: null,
};

describe("parseInline", () => {
  it("removes backslash escapes and bold markers, keeping bold runs", () => {
    expect(parseInline("- **Label**: a\\*b\\#c")).toEqual([
      { text: "- ", bold: false },
      { text: "Label", bold: true },
      { text: ": a*b#c", bold: false },
    ]);
  });
});

describe("plain-text Evidence Report", () => {
  const text = buildPlainTextReport(COMPLETE);
  const md = buildEvidenceReport(COMPLETE);

  it("has no Markdown syntax: no heading hashes, bold markers, or escape backslashes", () => {
    expect(text).not.toMatch(/^#/m);
    // The only "**" left is the literal text inside the AI label "Time **pressure**".
    expect(text.replace("Time **pressure**", "")).not.toContain("**");
    expect(text).not.toContain("\\");
    expect(md).toMatch(/^## /m); // the source report is Markdown
  });

  it("keeps every section heading, in order, as an underlined plain heading", () => {
    let at = -1;
    for (const s of REPORT_SECTIONS) {
      const i = text.indexOf(`${s}\n${"-".repeat(s.length)}`);
      expect(i, s).toBeGreaterThan(at);
      at = i;
    }
    expect(text.startsWith("SCRYVORN EVIDENCE REPORT\n========================\n")).toBe(true);
  });

  it("keeps untrusted values defanged and their punctuation literal", () => {
    expect(text).toContain("hxxps://evil[.]example[.]com/pay?x=1");
    expect(text).not.toContain("https://evil.example.com");
    expect(text).toContain("act *now* #1 [link](x)"); // shown literally, never as Markdown
    expect(text).toContain("Time **pressure**"); // a literal "**" from the AI label survives (it was escaped)
  });

  it("has the same wording as the Markdown report, line for line", () => {
    const strip = (s: string) => s.replace(/\\(.)/g, "$1").replace(/\*\*/g, "");
    const mdWords = md.split("\n").map((l) => strip(l.replace(/^#+ /, "").replace(/^ *- /, "").replace(/^\d+\. /, "")).trim()).filter(Boolean);
    const lines = buildReportDocument(COMPLETE).filter((l) => l.kind !== "blank").map((l) => ("spans" in l ? spansText(l.spans).trim() : ""));
    // Literal "**" in untrusted text is preserved by the document but stripped by the naive helper above.
    expect(lines.map((l) => l.replace(/\*\*/g, ""))).toEqual(mdWords.map((l) => l.replace(/\*\*/g, "")));
  });

  it("renders bullets, nested bullets, and numbered steps readably", () => {
    expect(text).toMatch(/^ {2}• Scan time: 2026-11-14 08:48:12 UTC$/m);
    expect(text).toMatch(/^ {6}– Matched text: /m);
    expect(text).toMatch(/^ {2}1\. Call the sender back/m);
  });

  it("explains an incomplete assessment", () => {
    expect(buildPlainTextReport(INCOMPLETE)).toContain(INCOMPLETE_ASSESSMENT_NOTICE);
  });

  it("rejects an invalid timestamp like the Markdown report", () => {
    expect(() => buildPlainTextReport({ ...COMPLETE, timestamp: "yesterday" })).toThrow(InvalidTimestampError);
  });

  it("collapses repeated blank lines and trims trailing blanks", () => {
    const lines = markdownToReportLines("# T\n\n\n## H\n\ntext\n\n\n");
    expect(lines.map((l) => l.kind)).toEqual(["title", "blank", "heading", "blank", "text"]);
    expect(renderPlainText(lines)).toBe("T\n=\n\nH\n-\n\ntext\n");
  });
});

describe("report filenames", () => {
  it("uses the UTC scan time with the requested extension", () => {
    expect(reportFilenameWithExtension("2026-11-14T10:48:12+02:00", "pdf")).toBe("scryvorn-report-20261114-084812.pdf");
    expect(reportFilenameWithExtension("2026-11-14T08:48:12Z", "txt")).toBe("scryvorn-report-20261114-084812.txt");
    expect(() => reportFilenameWithExtension("not a time", "pdf")).toThrow(InvalidTimestampError);
  });
});
