import { afterEach, describe, expect, it } from "vitest";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS, SEVERITY_TIERS } from "@/lib/constants";
import {
  AI_FINDINGS_ARE_INTERPRETATION_NOTICE,
  AI_NO_FINDINGS_NOTICE,
  CHECK_LABELS,
  INCOMPLETE_ASSESSMENT_NOTICE,
  INFORMATIONAL_CONTEXT_NOTICE,
  LOOKALIKE_INACTIVE_NOTICE,
} from "@/lib/report/evidenceReport";
import type { CompleteScanResult, IncompleteScanResult, ScanResult } from "@/lib/types";
import { contrastRatio, render, type Rendered } from "@/test/dom";
import { AdvisoryDisclaimer } from "./AdvisoryDisclaimer";
import { AI_HEADING, AI_PARTIAL_EVIDENCE_NOTICE, AiInterpretation } from "./AiInterpretation";
import {
  FINDINGS_HEADING,
  INFORMATIONAL_HEADING,
  NOT_PERFORMED_HEADING,
  NO_SCORED_FINDINGS_NOTICE,
  PARTIAL_FINDINGS_NOTICE,
  VERIFIED_CHECKS_HEADING,
  VERIFIED_CHECKS_SUBTITLE,
  VerifiedChecks,
} from "./VerifiedChecks";
import { NO_SCORED_SUMMARY, WaxSealVerdict, scoredSummary } from "./WaxSealVerdict";

// Synthetic fixtures only (.example / .test domains).
function f(
  over: Partial<DeterministicFinding> & Pick<DeterministicFinding, "check" | "category" | "weight">,
): DeterministicFinding {
  return {
    id: `${over.category}:${over.url ?? over.matchedText ?? "x"}`,
    source: "deterministic",
    label: `${over.category} label`,
    evidence: `${over.category} evidence`,
    severity: over.weight > 0 ? "medium" : "info",
    ...over,
  };
}

const HTTPS = f({ check: "https_status", category: "https_status", weight: 0, label: "HTTPS status", evidence: "Uses HTTPS", url: "https://pay.example.test/invoice" });
const TLD = f({ check: "domain_heuristic", category: "elevated_attention_tld", weight: 0, label: "Elevated-attention TLD", evidence: "TLD .test is on the reviewed list", url: "https://pay.example.test/invoice", reference: "tlds v1" });
const SHORT = f({ check: "shortener", category: "shortener", weight: 15, label: "URL shortener", evidence: "Destination hidden by https://short.example/abc", url: "https://short.example/abc" });
const TRIGGER = f({ check: "scam_triggers", category: "upfront_payment", weight: 12, severity: "high", label: "Upfront payment request", evidence: "Asks for a fee before work", matchedText: "pay the registration fee" });
const AGE_NOTE = f({ check: "domain_age", category: "domain_age_unavailable", weight: 0, label: "Domain registration age unavailable", evidence: "No domain-age data source is configured" });

const AI: AiFinding = {
  id: "ai:0",
  source: "ai",
  category: "credential_request",
  label: "Asks for a one-time code",
  evidence: "Quotes: send the code to http://verify.example",
  severity: "medium",
  weight: 15,
};

function complete(over: Partial<CompleteScanResult> = {}): CompleteScanResult {
  return {
    timestamp: "2026-11-14T08:48:12Z",
    inputType: "mixed",
    deterministicStatus: "complete",
    incompleteChecks: [],
    riskScore: 42,
    severityTier: "Caution — verify before acting",
    waxSealColor: "#D97706",
    deterministicFindings: [HTTPS, SHORT, TLD, TRIGGER, AGE_NOTE],
    aiFindings: [AI],
    recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
    aiAvailable: true,
    lookalikeCheckActive: false,
    domainAgeAvailable: false,
    disclaimer: ADVISORY_DISCLAIMER,
    ...over,
  };
}

function incomplete(over: Partial<IncompleteScanResult> = {}): IncompleteScanResult {
  return {
    timestamp: "2026-11-14T08:48:12Z",
    inputType: "mixed",
    deterministicStatus: "incomplete",
    incompleteChecks: ["domain_heuristic", "scam_triggers"],
    riskScore: null,
    severityTier: null,
    waxSealColor: null,
    deterministicFindings: [HTTPS, SHORT],
    aiFindings: [],
    recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
    aiAvailable: true,
    lookalikeCheckActive: false,
    domainAgeAvailable: false,
    disclaimer: ADVISORY_DISCLAIMER,
    ...over,
  };
}

let mounted: Rendered[] = [];
function mount(ui: Parameters<typeof render>[0]) {
  const r = render(ui);
  mounted.push(r);
  return r;
}
afterEach(() => {
  mounted.forEach((r) => r.unmount());
  mounted = [];
});

const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const sub = (c: HTMLElement, name: string) => c.querySelector(`[data-subarea="${name}"]`) as HTMLElement;

/** No live URL or clickable element anywhere. */
function expectNoLiveLinks(c: HTMLElement) {
  expect(c.querySelector("a")).toBeNull();
  expect(c.innerHTML).not.toMatch(/https?:\/\//i);
}

describe("VerifiedChecks", () => {
  it("shows the deterministic heading and subtitle", () => {
    const { container } = mount(<VerifiedChecks result={complete()} />);
    expect(text(container.querySelector("h2"))).toBe(VERIFIED_CHECKS_HEADING);
    expect(container.textContent).toContain(VERIFIED_CHECKS_SUBTITLE);
    const h3 = [...container.querySelectorAll("h3")].map(text);
    expect(h3).toEqual([FINDINGS_HEADING, INFORMATIONAL_HEADING, NOT_PERFORMED_HEADING]);
  });

  it("lists scored findings with check type, defanged URL, outcome, and score contribution", () => {
    const { container } = mount(<VerifiedChecks result={complete()} />);
    const findings = sub(container, "findings");
    const items = findings.querySelectorAll("li");
    expect(items).toHaveLength(2);
    const short = text(items[0]);
    expect(short).toContain("URL shortener");
    expect(short).toContain(CHECK_LABELS.shortener);
    expect(short).toContain("hxxps://short[.]example/abc");
    expect(short).toContain("Destination hidden by hxxps://short[.]example/abc");
    expect(text(items[0].querySelector("[data-weight]"))).toBe("+15");
    expect(text(items[1])).toContain("“pay the registration fee”");
    expect(text(items[1].querySelector("[data-weight]"))).toBe("+12");
  });

  it("puts weight-0 findings under Informational context with the note and no score contribution", () => {
    const { container } = mount(<VerifiedChecks result={complete()} />);
    const info = sub(container, "informational");
    expect(info.textContent).toContain(INFORMATIONAL_CONTEXT_NOTICE);
    const cats = [...info.querySelectorAll("[data-finding]")].map((e) => e.getAttribute("data-finding"));
    expect(cats).toEqual(["https_status", "elevated_attention_tld"]);
    expect(info.querySelector("[data-weight]")).toBeNull();
    expect(info.textContent).not.toMatch(/score contribution/i);
    expect(sub(container, "findings").querySelector('[data-finding="https_status"]')).toBeNull();
  });

  it("shows the lookalike and domain-age notes only under Checks not performed", () => {
    const { container } = mount(<VerifiedChecks result={complete()} />);
    const np = sub(container, "not-performed");
    expect(np.textContent).toContain(LOOKALIKE_INACTIVE_NOTICE);
    expect(np.textContent).toContain("Domain registration age unavailable");
    const all = container.textContent ?? "";
    expect(all.split(LOOKALIKE_INACTIVE_NOTICE)).toHaveLength(2); // exactly once
    expect(sub(container, "informational").textContent).not.toContain("Domain registration age unavailable");
    expect(sub(container, "findings").textContent).not.toContain("Lookalike");
  });

  it("omits the lookalike notice when the check is configured", () => {
    const { container } = mount(
      <VerifiedChecks result={complete({ lookalikeCheckActive: true, deterministicFindings: [SHORT] })} />,
    );
    expect(container.textContent).not.toContain(LOOKALIKE_INACTIVE_NOTICE);
    expect(text(sub(container, "not-performed"))).toContain("None reported.");
  });

  it("states that no scored findings is not proof of safety", () => {
    const { container } = mount(<VerifiedChecks result={complete({ deterministicFindings: [HTTPS] })} />);
    expect(sub(container, "findings").textContent).toContain(NO_SCORED_FINDINGS_NOTICE);
  });

  it("renders only deterministic findings (never AI findings)", () => {
    const { container } = mount(<VerifiedChecks result={complete()} />);
    expect(container.textContent).not.toContain(AI.label);
  });

  it("incomplete run: partial notice, collected findings, and unfinished checks with report labels", () => {
    const { container } = mount(<VerifiedChecks result={incomplete()} />);
    expect(container.textContent).toContain(PARTIAL_FINDINGS_NOTICE);
    expect(sub(container, "findings").textContent).toContain("URL shortener");
    const np = sub(container, "not-performed");
    expect(np.textContent).toContain(`${CHECK_LABELS.domain_heuristic}: did not finish`);
    expect(np.textContent).toContain(`${CHECK_LABELS.scam_triggers}: did not finish`);
    expect(np.textContent).toContain("A missing finding here is not a passed check.");
    expect(np.textContent).toContain("Domain age: skipped because the required checks did not complete.");
  });

  it("renders hostile text inertly as plain, defanged text", () => {
    const hostile = f({
      check: "scam_triggers",
      category: "x",
      weight: 12,
      label: '<img src=x onerror="alert(1)">',
      evidence: "<script>alert(1)</script> [click](https://evil.example)",
      url: "javascript://evil.example/%0aalert(1)",
      matchedText: "<b>bold</b>",
    });
    const { container } = mount(<VerifiedChecks result={complete({ deterministicFindings: [hostile] })} />);
    expect(container.querySelector("img, script, b, a")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.textContent).toContain("javascript[://]evil[.]example");
    expectNoLiveLinks(container);
  });
});

describe("AiInterpretation", () => {
  it("shows the AI heading and labels findings as model interpretation with confidence", () => {
    const { container } = mount(<AiInterpretation result={complete()} />);
    expect(text(container.querySelector("h2"))).toBe(AI_HEADING);
    expect(container.textContent).toContain(AI_FINDINGS_ARE_INTERPRETATION_NOTICE);
    const item = container.querySelector("[data-ai-finding]")!;
    expect(item.textContent).toContain("Model interpretation");
    expect(text(item.querySelector("[data-confidence]"))).toBe("Medium");
    expect(item.textContent).toContain("hxxp://verify[.]example");
    expectNoLiveLinks(container);
  });

  it("timeout state", () => {
    const { container } = mount(
      <AiInterpretation result={complete({ aiAvailable: false, aiUnavailableReason: "timeout", aiFindings: [] })} />,
    );
    expect(text(container.querySelector('[data-ai-state="unavailable"]'))).toBe(
      "AI analysis unavailable (the AI service did not respond in time).",
    );
  });

  it("error state", () => {
    const { container } = mount(
      <AiInterpretation result={complete({ aiAvailable: false, aiUnavailableReason: "error", aiFindings: [] })} />,
    );
    expect(text(container.querySelector('[data-ai-state="unavailable"]'))).toBe(
      "AI analysis unavailable (the AI service returned an error or an unusable response).",
    );
  });

  it("never renders AI findings when AI is unavailable, even if some are present", () => {
    const { container } = mount(
      <AiInterpretation result={complete({ aiAvailable: false, aiUnavailableReason: "error", aiFindings: [AI] })} />,
    );
    expect(container.querySelector("[data-ai-finding]")).toBeNull();
    expect(container.textContent).not.toContain(AI.label);
  });

  it("no-findings state", () => {
    const { container } = mount(<AiInterpretation result={complete({ aiFindings: [] })} />);
    expect(text(container.querySelector('[data-ai-state="no-findings"]'))).toBe(AI_NO_FINDINGS_NOTICE);
  });

  it("adds the partial-evidence note only when AI ran after an incomplete run", () => {
    const ran = mount(<AiInterpretation result={incomplete()} />);
    expect(ran.container.textContent).toContain(AI_PARTIAL_EVIDENCE_NOTICE);
    const notRan = mount(<AiInterpretation result={incomplete({ aiAvailable: false, aiUnavailableReason: "timeout" })} />);
    expect(notRan.container.textContent).not.toContain(AI_PARTIAL_EVIDENCE_NOTICE);
    const full = mount(<AiInterpretation result={complete()} />);
    expect(full.container.textContent).not.toContain(AI_PARTIAL_EVIDENCE_NOTICE);
  });

  it("renders only AI findings (never deterministic findings)", () => {
    const { container } = mount(<AiInterpretation result={complete()} />);
    expect(container.textContent).not.toContain("URL shortener");
  });

  it("renders hostile AI text inertly", () => {
    const evil: AiFinding = { ...AI, label: "<a href='https://x.example'>x</a>", evidence: "<script>1</script>" };
    const { container } = mount(<AiInterpretation result={complete({ aiFindings: [evil] })} />);
    expect(container.querySelector("a, script")).toBeNull();
    expectNoLiveLinks(container);
  });
});

describe("WaxSealVerdict", () => {
  it.each(SEVERITY_TIERS.map((t) => [t.tier, t.color, t.min] as const))(
    "complete %s: shows score, tier, and the tier color on the seal",
    (tier, color, score) => {
      const { container } = mount(
        <WaxSealVerdict result={complete({ riskScore: score, severityTier: tier, waxSealColor: color })} />,
      );
      expect(container.querySelector('[data-verdict="complete"]')).not.toBeNull();
      expect(text(container.querySelector("[data-score]"))).toBe(String(score));
      expect(text(container.querySelector("[data-tier]"))).toBe(tier);
      const seal = container.querySelector("[data-wax-seal]") as HTMLElement;
      expect(seal.style.borderColor.replace(/\s/g, "")).toBe(hexToRgb(color));
    },
  );

  it("never uses 'Verified Safe' or the word 'safe' (any tier, any state)", () => {
    for (const t of SEVERITY_TIERS) {
      const r = mount(<WaxSealVerdict result={complete({ riskScore: t.min, severityTier: t.tier, waxSealColor: t.color })} />);
      expect(r.container.textContent).not.toMatch(/safe/i);
    }
    const r = mount(<WaxSealVerdict result={incomplete()} />);
    expect(r.container.textContent).not.toMatch(/safe/i);
  });

  it("shows a short summary of scored findings, not the full list", () => {
    const { container } = mount(<WaxSealVerdict result={complete()} />);
    expect(text(container.querySelector("[data-summary]"))).toBe(
      "3 scored findings (2 rule-based, 1 AI). Highest finding severity: High.",
    );
    expect(container.textContent).not.toContain("URL shortener");
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("summary excludes AI findings when AI is unavailable and handles zero scored findings", () => {
    const r = complete({ deterministicFindings: [HTTPS], aiAvailable: false, aiUnavailableReason: "timeout", aiFindings: [AI] });
    expect(scoredSummary(r)).toBe(NO_SCORED_SUMMARY);
  });

  it("incomplete: neutral panel with exact notice, unfinished checks, no score, tier, color, or seal", () => {
    const { container } = mount(<WaxSealVerdict result={incomplete()} />);
    expect(container.textContent).toContain(INCOMPLETE_ASSESSMENT_NOTICE);
    const unfinished = [...container.querySelectorAll("[data-unfinished]")].map(text);
    expect(unfinished).toEqual([CHECK_LABELS.domain_heuristic, CHECK_LABELS.scam_triggers]);
    expect(container.querySelector("[data-wax-seal], [data-score], [data-tier]")).toBeNull();
    expect(container.innerHTML).not.toMatch(/style=/);
    for (const t of SEVERITY_TIERS) expect(container.textContent).not.toContain(t.tier);
    expect(container.textContent).not.toMatch(/\/ 100|low risk/i);
  });

  it("seal text is dark ink on parchment (contrast ≥ 4.5:1)", () => {
    expect(contrastRatio("#1A1614", "#F8F3E6")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("AdvisoryDisclaimer", () => {
  it("renders ADVISORY_DISCLAIMER exactly", () => {
    const { container } = mount(<AdvisoryDisclaimer />);
    expect(text(container.querySelector("aside"))).toBe(ADVISORY_DISCLAIMER);
    expect(container.querySelector("aside")!.getAttribute("aria-label")).toBe("Advisory disclaimer");
  });
});

function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r},${g},${b})`;
}

// Type-level guard: both variants are accepted by every results component.
const _accepts: ScanResult[] = [complete(), incomplete()];
void _accepts;
