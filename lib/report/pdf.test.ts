import { describe, expect, it } from "vitest";
import { ADVISORY_DISCLAIMER } from "@/lib/constants";
import type { CompleteScanResult } from "@/lib/types";
import { PDF_SUBSTITUTION_NOTICE, REPORT_PDF_TITLE, buildReportPdf, toWinAnsi } from "./pdf";
import { buildReportDocument, type ReportLine } from "./reportDocument";

const RESULT: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12Z",
  inputType: "message",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 72,
  severityTier: "TRAP DETECTED",
  waxSealColor: "#B91C1C",
  deterministicFindings: [
    {
      id: "scam_trigger:upfront_payment",
      source: "deterministic",
      check: "scam_triggers",
      category: "upfront_payment",
      label: "upfront payment (fee)",
      evidence: 'Matched "processing fee" — pay (now) \\ today.',
      matchedText: "processing fee",
      severity: "high",
      weight: 20,
    },
  ],
  aiFindings: [],
  recommendedSteps: ["Do not pay."],
  aiAvailable: true,
  lookalikeCheckActive: false,
  domainAgeAvailable: false,
  disclaimer: ADVISORY_DISCLAIMER,
};

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

/** Checks the cross-reference table: each offset must point at "<n> 0 obj". */
function checkXref(pdf: string) {
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)![1]);
  expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  const m = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(pdf.slice(startxref))!;
  const count = Number(m[1]);
  const entries = m[2].split("\n").filter(Boolean);
  expect(entries).toHaveLength(count);
  for (const e of entries) expect(e.length).toBe(19); // 20 bytes with the "\n"
  entries.slice(1).forEach((e, i) => {
    const off = Number(e.slice(0, 10));
    expect(pdf.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
  });
  return count;
}

describe("buildReportPdf", () => {
  it("produces a structurally valid PDF 1.4 with a correct xref table and stream lengths", () => {
    const out = buildReportPdf(buildReportDocument(RESULT), { title: REPORT_PDF_TITLE });
    const pdf = latin1(out.bytes);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    const objects = checkXref(pdf);
    expect(objects).toBe(6 + out.pageCount * 2);
    expect(pdf).toContain(`/Count ${out.pageCount}`);
    for (const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      expect(pdf.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe("\nendstream");
    }
    expect(pdf).toContain("/BaseFont /Helvetica ");
    expect(pdf).toContain("/BaseFont /Helvetica-Bold ");
    expect(out.substituted).toBe(false);
  });

  it("contains the report text (escaped), with no Markdown symbols, and a page footer", () => {
    const pdf = latin1(buildReportPdf(buildReportDocument(RESULT), { title: REPORT_PDF_TITLE }).bytes);
    expect(pdf).toContain("(Scored deterministic findings) Tj");
    expect(pdf).toContain("(Assessment status and coverage) Tj");
    expect(pdf).toContain("pay \\(now\\) \\\\ today"); // parentheses and backslash escaped for PDF
    expect(pdf).toContain("\x97"); // em dash encoded in WinAnsi
    expect(pdf).toContain("Page 1 of 1");
    expect(pdf).not.toMatch(/\(#+ /);
    expect(pdf).not.toContain("**");
    expect(pdf).not.toMatch(/\/(URI|JavaScript|JS|Launch|OpenAction|AA)\b/); // inert: no links or actions
  });

  it("wraps long text and paginates with a footer on every page", () => {
    const long: ReportLine[] = [{ kind: "title", spans: [{ text: "T", bold: false }] }];
    for (let i = 0; i < 150; i++) {
      long.push({ kind: "bullet", level: 0, spans: [{ text: `Item ${i} `.repeat(30), bold: false }] });
    }
    long.push({ kind: "text", spans: [{ text: "hxxps://" + "x".repeat(400), bold: false }] }); // one unbreakable word
    const out = buildReportPdf(long, { title: REPORT_PDF_TITLE });
    expect(out.pageCount).toBeGreaterThan(3);
    const pdf = latin1(out.bytes);
    checkXref(pdf);
    for (let p = 1; p <= out.pageCount; p++) expect(pdf).toContain(`Page ${p} of ${out.pageCount}`);
  });

  it("never substitutes characters silently: it states the substitution in the PDF", () => {
    const lines: ReportLine[] = [{ kind: "text", spans: [{ text: "Message: 你好 🙂 café", bold: false }] }];
    const out = buildReportPdf(lines, { title: REPORT_PDF_TITLE });
    expect(out.substituted).toBe(true);
    const pdf = latin1(out.bytes);
    expect(pdf).toContain("Some characters in this report could not be shown in the PDF");
    expect(PDF_SUBSTITUTION_NOTICE).toContain(".txt");
    expect(pdf).toContain("caf\xe9"); // Latin-1 text is kept
  });
});

describe("toWinAnsi", () => {
  it("maps CP1252 punctuation and flags unrepresentable characters", () => {
    expect(toWinAnsi("“a” – b — c •")).toEqual({ bytes: "\x93a\x94 \x96 b \x97 c \x95", lost: false });
    expect(toWinAnsi("x\u{1F642}")).toEqual({ bytes: "x?", lost: true });
  });
});
