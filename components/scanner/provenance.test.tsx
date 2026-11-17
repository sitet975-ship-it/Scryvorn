/**
 * Provenance display: every rule-based item shows whether it came from message
 * rules or link checks, and every AI finding is labelled AI interpretation.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import type { CompleteScanResult, IncompleteScanResult } from "@/lib/types";
import { render, type Rendered } from "@/test/dom";
import { AiInterpretation } from "./AiInterpretation";
import { VerifiedChecks } from "./VerifiedChecks";

const TRIGGER: DeterministicFinding = {
  id: "t", source: "deterministic", check: "scam_triggers", category: "urgency_pressure",
  label: "urgency pressure", evidence: "Matched", matchedText: "act now", severity: "medium", weight: 12,
};
const HTTPS: DeterministicFinding = {
  id: "h", source: "deterministic", check: "https_status", category: "https_status",
  label: "HTTPS status", evidence: "Uses HTTPS", url: "https://a.example/x", severity: "info", weight: 0,
};
const AI: AiFinding = { id: "a", source: "ai", category: "pressure", label: "Pressure", evidence: "e", severity: "low", weight: 8 };

const BASE: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12Z", inputType: "mixed", deterministicStatus: "complete", incompleteChecks: [],
  riskScore: 20, severityTier: "Low risk — still verify independently", waxSealColor: "#15803D",
  deterministicFindings: [TRIGGER, HTTPS], aiFindings: [AI], recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
  aiAvailable: true, lookalikeCheckActive: false, domainAgeAvailable: false, disclaimer: ADVISORY_DISCLAIMER,
};

let mounted: Rendered[] = [];
afterEach(() => { mounted.forEach((r) => r.unmount()); mounted = []; });
const mount = (ui: Parameters<typeof render>[0]) => { const r = render(ui); mounted.push(r); return r.container; };

describe("provenance badges", () => {
  it("labels message-rule evidence, link-check context, and unavailable link checks", () => {
    const c = mount(<VerifiedChecks result={BASE} />);
    const source = (sel: string) => c.querySelector(sel)!.querySelector("[data-source]")!;
    expect(source('[data-subarea="findings"] li').getAttribute("data-source")).toBe("message_rules");
    expect(source('[data-subarea="findings"] li').textContent).toBe("Message rules");
    expect(source('[data-subarea="informational"] li').getAttribute("data-source")).toBe("link_checks");
    expect(source('[data-subarea="not-performed"] li').textContent).toBe("Link checks");
  });

  it("labels unfinished checks by the layer that did not finish", () => {
    const inc: IncompleteScanResult = {
      ...BASE, deterministicStatus: "incomplete", incompleteChecks: ["scam_triggers"],
      riskScore: null, severityTier: null, waxSealColor: null,
    };
    const c = mount(<VerifiedChecks result={inc} />);
    const li = c.querySelector('[data-unfinished="scam_triggers"]')!;
    expect(li.querySelector("[data-source]")!.textContent).toBe("Message rules");
  });

  it("labels every AI finding as AI interpretation", () => {
    const c = mount(<AiInterpretation result={BASE} />);
    const badges = [...c.querySelectorAll("[data-ai-finding] [data-source]")];
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("AI interpretation");
  });
});
