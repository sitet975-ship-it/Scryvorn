import { afterEach, describe, expect, it } from "vitest";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import {
  STEPS_ARE_RECOMMENDATIONS_NOTICE,
  STEP_SOURCE_LABELS,
  buildEvidenceReport,
  selectRecommendedSteps,
} from "@/lib/report/evidenceReport";
import type { CompleteScanResult } from "@/lib/types";
import { render, type Rendered } from "@/test/dom";
import { RECOMMENDED_STEPS_HEADING, RecommendedSteps } from "./RecommendedSteps";

const BASE: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12Z",
  inputType: "message",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 0,
  severityTier: "Low risk — still verify independently",
  waxSealColor: "#059669",
  deterministicFindings: [],
  aiFindings: [],
  recommendedSteps: ["Call the bank using the number on your card.", "Ignore https://pay.example.test/now"],
  aiAvailable: true,
  lookalikeCheckActive: false,
  domainAgeAvailable: false,
  disclaimer: ADVISORY_DISCLAIMER,
};

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

const items = (c: HTMLElement) => [...c.querySelectorAll("ol li")].map((li) => li.textContent);
const source = (c: HTMLElement) => c.querySelector("[data-step-source]")!;

describe("selectRecommendedSteps (shared rule)", () => {
  it("uses AI steps only when AI is available and returned steps", () => {
    expect(selectRecommendedSteps(BASE)).toEqual({ steps: BASE.recommendedSteps, source: "ai" });
    expect(selectRecommendedSteps({ ...BASE, recommendedSteps: [] })).toEqual({
      steps: FALLBACK_VERIFICATION_STEPS,
      source: "standard",
    });
    expect(selectRecommendedSteps({ ...BASE, aiAvailable: false })).toEqual({
      steps: FALLBACK_VERIFICATION_STEPS,
      source: "standard",
    });
  });

  it("labels AI steps identical to the fallback list as standard guidance", () => {
    expect(selectRecommendedSteps({ ...BASE, recommendedSteps: [...FALLBACK_VERIFICATION_STEPS] }).source).toBe("standard");
  });

  it("the report uses the same selection and source label", () => {
    const report = buildEvidenceReport(BASE);
    expect(report).toContain(`Source: ${STEP_SOURCE_LABELS.ai}.`);
    const fallback = buildEvidenceReport({ ...BASE, aiAvailable: false, aiUnavailableReason: "error" });
    expect(fallback).toContain(`Source: ${STEP_SOURCE_LABELS.standard}.`);
  });
});

describe("RecommendedSteps", () => {
  it("shows the heading, notice, AI source label, and defanged plain-text steps", () => {
    const { container } = mount(<RecommendedSteps result={BASE} />);
    expect(container.querySelector("h2")!.textContent).toBe(RECOMMENDED_STEPS_HEADING);
    expect(RECOMMENDED_STEPS_HEADING).toBe("Recommended verification steps");
    expect(container.textContent).toContain(STEPS_ARE_RECOMMENDATIONS_NOTICE);
    expect(source(container).getAttribute("data-step-source")).toBe("ai");
    expect(source(container).textContent).toBe("Source: AI interpretation (model-generated; review before acting)");
    expect(items(container)).toEqual([
      "Call the bank using the number on your card.",
      "Ignore hxxps://pay[.]example[.]test/now",
    ]);
    expect(container.querySelector("a")).toBeNull();
  });

  it.each([
    ["AI unavailable (timeout)", { aiAvailable: false, aiUnavailableReason: "timeout" as const }],
    ["AI unavailable (error)", { aiAvailable: false, aiUnavailableReason: "error" as const }],
    ["AI returned no steps", { recommendedSteps: [] }],
  ])("%s: shows the fallback steps with the standard source label", (_n, over) => {
    const { container } = mount(<RecommendedSteps result={{ ...BASE, ...over }} />);
    expect(source(container).getAttribute("data-step-source")).toBe("standard");
    expect(source(container).textContent).toBe("Source: Scryvorn's standard verification guidance");
    expect(items(container)).toEqual([...FALLBACK_VERIFICATION_STEPS]);
  });

  it("renders hostile step text inertly", () => {
    const { container } = mount(
      <RecommendedSteps result={{ ...BASE, recommendedSteps: ['<a href="https://evil.example">x</a><script>1</script>'] }} />,
    );
    expect(container.querySelector("a, script")).toBeNull();
    expect(container.innerHTML).not.toMatch(/https?:\/\//);
  });
});
