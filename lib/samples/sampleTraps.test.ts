import { describe, expect, it } from "vitest";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import { extractUrls } from "@/lib/checks/urlExtractor";
import { INPUT_MAX_CHARS } from "@/lib/constants";
import { partitionDeterministicFindings } from "@/lib/report/evidenceReport";
import { computeRiskScore, severityTierForScore } from "@/lib/scoring/riskScore";
import { SAMPLE_TRAP_LABELS } from "@/components/scanner/SampleTrapButtons";
import { SAMPLE_TRAPS } from "./sampleTraps";

const byLabel = (label: string) => SAMPLE_TRAPS.find((s) => s.label === label)!;

async function outcome(label: string) {
  const det = await runDeterministicChecks(byLabel(label).content);
  const { scored, informational, ageNotes } = partitionDeterministicFindings(det.findings);
  return {
    det,
    scored: scored.map((f) => [f.category, f.matchedText, f.weight]),
    informational: informational.map((f) => [f.category, f.url, f.evidence]),
    ageNotes: ageNotes.map((f) => f.id),
    deterministicOnlyScore: computeRiskScore(det.findings, []),
  };
}

describe("SAMPLE_TRAPS data rules", () => {
  it("has exactly the three required labels, in button order", () => {
    expect(SAMPLE_TRAPS.map((s) => s.label)).toEqual([...SAMPLE_TRAP_LABELS]);
    expect(new Set(SAMPLE_TRAPS.map((s) => s.id)).size).toBe(3);
  });

  it("uses only .example / .test URLs and placeholder amounts", () => {
    for (const s of SAMPLE_TRAPS) {
      for (const url of extractUrls(s.content)) {
        expect(new URL(url).hostname).toMatch(/\.(example|test)$/);
      }
      expect(s.content).not.toMatch(/bit\.ly|tinyurl\.com|t\.co\b|goo\.gl|ow\.ly|is\.gd|buff\.ly/i);
      // Any dollar amount is the placeholder.
      for (const m of s.content.matchAll(/\$\S+/g)) expect(m[0].replace(/[.,]$/, "")).toBe("$XX.XX");
      expect(s.content.length).toBeLessThanOrEqual(INPUT_MAX_CHARS);
      expect(s.content).not.toMatch(/\bsafe\b|verified|legitimate/i);
    }
  });

  it("the bank alert includes independent-verification guidance", () => {
    const c = byLabel("Legitimate Bank Alert").content;
    expect(c).toContain("Open the official Example Bank app");
    expect(c).toContain("call the number printed on the back of your card");
    expect(c).toContain("do not use any link in it");
  });
});

describe("SAMPLE_TRAPS deterministic outcomes (no AI, no domain-age service)", () => {
  it("Fake Remote Job DM: four scam-trigger findings, HTTPS context, domain-age note", async () => {
    const o = await outcome("Fake Remote Job DM");
    expect(o.det.status).toBe("complete");
    expect(o.det.incompleteChecks).toEqual([]);
    expect(o.det.lookalikeCheckActive).toBe(false);
    expect(o.det.domainAgeAvailable).toBe(false);
    expect(o.scored).toEqual([
      ["upfront_payment", "registration fee", 12],
      ["urgency_pressure", "Act now", 12],
      ["off_platform_move", "WhatsApp me", 12],
      ["suspicious_job_offer", "work from home", 12],
    ]);
    expect(o.informational).toEqual([
      [
        "https_status",
        "https://careers-portal.example/apply",
        "Uses HTTPS (encrypted connection). HTTPS alone does not indicate a link is trustworthy.",
      ],
    ]);
    expect(o.ageNotes).toEqual(["domain_age_unavailable:not_configured"]);
    // 4 x 12 = 48 (scam-trigger cap is 60). The link has no risky structure.
    // Without AI this already reaches the Caution tier.
    expect(o.deterministicOnlyScore).toBe(48);
    expect(severityTierForScore(48).tier).toBe("Caution — verify before acting");
  });

  it("Phishing Payment Link: link-structure and scam-trigger findings, non-HTTPS context, domain-age note", async () => {
    const o = await outcome("Phishing Payment Link");
    expect(o.det.status).toBe("complete");
    expect(o.det.incompleteChecks).toEqual([]);
    expect(o.scored).toEqual([
      ["sensitive_host_keywords", undefined, 15],
      ["sensitive_path_keywords", undefined, 10],
      ["upfront_payment", "processing fee", 12],
      ["credential_request", "Verify your identity", 12],
      ["urgency_pressure", "FINAL NOTICE", 12],
    ]);
    expect(o.informational).toEqual([
      [
        "https_status",
        "http://examplepay-billing.test/verify",
        "Does not use HTTPS. This alone is not evidence of a scam.",
      ],
    ]);
    expect(o.ageNotes).toEqual(["domain_age_unavailable:not_configured"]);
    // "billing" in the host (15) + "verify" in the path (10) + 3 x 12 = 61.
    expect(o.deterministicOnlyScore).toBe(61);
    expect(severityTierForScore(61).tier).toBe("Caution — verify before acting");
  });

  it("Legitimate Bank Alert: complete run with zero findings of any kind", async () => {
    const o = await outcome("Legitimate Bank Alert");
    expect(o.det.status).toBe("complete");
    expect(o.det.incompleteChecks).toEqual([]);
    expect(o.det.findings).toEqual([]); // no URLs, no triggers, so no domain-age note either
    expect(o.scored).toEqual([]);
    expect(o.deterministicOnlyScore).toBe(0);
    // The lowest tier still says to verify independently; it never says "safe".
    expect(severityTierForScore(0).tier).toBe("Low risk — still verify independently");
  });
});
