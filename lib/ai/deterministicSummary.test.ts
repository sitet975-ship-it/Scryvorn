import { describe, expect, it } from "vitest";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import type { DeterministicFinding, DeterministicResult } from "@/lib/checks/types";
import {
  DETERMINISTIC_SUMMARY_MAX_FINDINGS,
  DETERMINISTIC_SUMMARY_MAX_LINE_CHARS,
  DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS,
} from "@/lib/constants";
import { buildDeterministicSummary } from "./deterministicSummary";

function finding(over: Partial<DeterministicFinding> = {}): DeterministicFinding {
  return {
    id: "x",
    source: "deterministic",
    check: "shortener",
    category: "shortener",
    label: "URL shortener",
    evidence: "EVIDENCE-SHOULD-NOT-APPEAR",
    url: "https://bit.ly/abc?token=SECRETPATH",
    severity: "low",
    weight: 77,
    ...over,
  };
}

function result(findings: DeterministicFinding[], over: Partial<DeterministicResult> = {}): DeterministicResult {
  return {
    findings,
    status: "complete",
    incompleteChecks: [],
    domainAgeAvailable: false,
    lookalikeCheckActive: false,
    ...over,
  };
}

const lines = (s: string) => s.split("\n");

describe("buildDeterministicSummary: format", () => {
  it("uses the approved cap values", () => {
    expect(DETERMINISTIC_SUMMARY_MAX_FINDINGS).toBe(20);
    expect(DETERMINISTIC_SUMMARY_MAX_LINE_CHARS).toBe(200);
    expect(DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS).toBe(3000);
  });

  it("starts with the status line, then one line per finding in engine order", () => {
    const s = buildDeterministicSummary(
      result([
        finding(),
        finding({ check: "scam_triggers", category: "urgency_pressure", label: "urgency pressure", url: undefined, matchedText: "act now" }),
        finding({ check: "domain_age", category: "domain_age_unavailable", label: "Domain registration age unavailable", url: undefined }),
      ]),
    );
    expect(lines(s)).toEqual([
      "status: complete",
      "- shortener | URL shortener | host: bit.ly",
      "- urgency_pressure | urgency pressure | matched: act now",
      "- domain_age_unavailable | Domain registration age unavailable",
    ]);
  });

  it("lists unfinished checks for an incomplete run", () => {
    const s = buildDeterministicSummary(
      result([], { status: "incomplete", incompleteChecks: ["domain_heuristic", "scam_triggers"] }),
    );
    expect(s).toBe("status: incomplete; unfinished: domain_heuristic, scam_triggers");
  });

  it("treats unfinished checks as incomplete even if status says complete", () => {
    const s = buildDeterministicSummary(result([], { incompleteChecks: ["scam_triggers"] }));
    expect(s).toBe("status: incomplete; unfinished: scam_triggers");
  });

  it("uses a bare hostname for domain-age findings", () => {
    const s = buildDeterministicSummary(
      result([finding({ check: "domain_age", category: "domain_age", label: "Domain registration age", url: "Young-Site.example" })]),
    );
    expect(lines(s)[1]).toBe("- domain_age | Domain registration age | host: young-site.example");
  });

  it("excludes weights, scores, tiers, evidence, and raw URLs", () => {
    const s = buildDeterministicSummary(
      result([
        finding(),
        finding({ check: "https_status", category: "https_status", label: "HTTPS status for https://evil.example/pay?id=SECRETPATH", url: "https://evil.example/pay?id=SECRETPATH", weight: 0 }),
      ]),
    );
    expect(s).not.toContain("77");
    expect(s).not.toMatch(/weight|score|tier|TRAP|Caution|Low risk|#[0-9A-F]{6}/i);
    expect(s).not.toContain("EVIDENCE-SHOULD-NOT-APPEAR");
    expect(s).not.toContain("SECRETPATH");
    expect(s).not.toMatch(/https?:\/\//);
    expect(lines(s)[2]).toBe("- https_status | HTTPS status for evil.example | host: evil.example");
  });

  it("collapses line breaks and control characters inside fields", () => {
    const s = buildDeterministicSummary(
      result([finding({ check: "scam_triggers", category: "upfront_payment", label: "upfront\npayment", url: undefined, matchedText: "pay\r\n\tnow\u202E" })]),
    );
    expect(lines(s)).toHaveLength(2);
    expect(lines(s)[1]).toBe("- upfront_payment | upfront payment | matched: pay now");
  });

  it("is deterministic for a real engine result", async () => {
    const det = await runDeterministicChecks("Act now! Pay the processing fee at https://bit.ly/x or www.promo.xyz/y");
    expect(buildDeterministicSummary(det)).toBe(buildDeterministicSummary(det));
    expect(buildDeterministicSummary(det).startsWith("status: complete\n")).toBe(true);
  });
});

describe("buildDeterministicSummary: caps", () => {
  it("cuts long lines to the per-line cap with an ellipsis", () => {
    const s = buildDeterministicSummary(result([finding({ label: "L".repeat(500) })]));
    const line = lines(s)[1];
    expect(line).toHaveLength(DETERMINISTIC_SUMMARY_MAX_LINE_CHARS);
    expect(line.endsWith("…")).toBe(true);
  });

  it("does not split a surrogate pair when cutting", () => {
    const s = buildDeterministicSummary(result([finding({ label: "😀".repeat(300) })]));
    const line = lines(s)[1];
    expect(line.length).toBeLessThanOrEqual(DETERMINISTIC_SUMMARY_MAX_LINE_CHARS);
    expect(line).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("includes at most 20 findings and says how many were omitted", () => {
    const many = Array.from({ length: 25 }, (_, i) => finding({ id: `f${i}`, label: `label ${i}` }));
    const ls = lines(buildDeterministicSummary(result(many)));
    expect(ls).toHaveLength(1 + 20 + 1);
    expect(ls[1]).toContain("label 0");
    expect(ls[20]).toContain("label 19");
    expect(ls[21]).toBe("- (5 more findings omitted)");
  });

  it("keeps the whole summary within the total cap and reports omissions", () => {
    const long = Array.from({ length: 20 }, (_, i) => finding({ id: `f${i}`, label: `${i} ${"x".repeat(400)}` }));
    const s = buildDeterministicSummary(result(long));
    const ls = lines(s);
    expect(s.length).toBeLessThanOrEqual(DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS);
    const findingLines = ls.slice(1, -1);
    expect(findingLines.length).toBeGreaterThan(0);
    expect(findingLines.length).toBeLessThan(20);
    expect(ls[ls.length - 1]).toBe(`- (${20 - findingLines.length} more findings omitted)`);
    // Engine order is kept: the included findings are the first ones.
    findingLines.forEach((l, i) => expect(l.startsWith(`- shortener | ${i} `)).toBe(true));
  });

  it("adds no omission line when everything fits", () => {
    const s = buildDeterministicSummary(result([finding(), finding()]));
    expect(s).not.toContain("omitted");
  });

  it("returns only the status line when there are no findings", () => {
    expect(buildDeterministicSummary(result([]))).toBe("status: complete");
  });
});
