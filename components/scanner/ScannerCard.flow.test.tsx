/**
 * Task 11.2 assertions not already covered by ScannerCard.test.tsx,
 * scanner.test.tsx, results.test.tsx, EvidenceReportExport.test.tsx, and
 * RoadmapSection.test.tsx.
 *
 * Uses React 19 act + jsdom helpers (test/dom.ts). jsdom does not verify
 * visible focus rings, real tab order, layout, real clipboard writes, or real
 * downloads; those are manual browser checks.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import { FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import { AI_NO_FINDINGS_NOTICE } from "@/lib/report/evidenceReport";
import { SAMPLE_TRAPS } from "@/lib/samples/sampleTraps";
import { assessScan } from "@/lib/scoring/assessment";
import type { ScanResult } from "@/lib/types";
import { click, render, submit, typeValue, type Rendered } from "@/test/dom";
import { AI_HEADING } from "./AiInterpretation";
import { LOADING_TEXT } from "./LoadingState";
import { RECOMMENDED_STEPS_HEADING } from "./RecommendedSteps";
import { BACK_TO_ASSESSMENT_LABEL, NEW_INVESTIGATION_LABEL, ScannerCard, VIEW_REPORT_LABEL } from "./ScannerCard";
import { INPUT_REQUIRED_MESSAGE } from "./ScannerInput";
import {
  FINDINGS_HEADING,
  INFORMATIONAL_HEADING,
  NOT_PERFORMED_HEADING,
  VERIFIED_CHECKS_HEADING,
} from "./VerifiedChecks";
import { VERDICT_HEADING } from "./WaxSealVerdict";

let mounted: Rendered[] = [];
function mount(ui: Parameters<typeof render>[0]) {
  const r = render(ui);
  mounted.push(r);
  return r;
}
afterEach(() => {
  mounted.forEach((r) => r.unmount());
  mounted = [];
  vi.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** fetch mock that answers every call with the same status and body. */
function fixedFetch(status: number, body: unknown) {
  const mock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({ status, json: async () => body }) as unknown as Response);
  return { mock, fetchImpl: mock as unknown as typeof fetch };
}

const q = (c: HTMLElement) => ({
  textarea: c.querySelector("textarea")!,
  form: c.querySelector("form")!,
  status: c.querySelector('[role="status"]')!,
  inputError: c.querySelector("form p[aria-live]")!,
  samples: [...c.querySelectorAll('[role="group"] button')] as HTMLButtonElement[],
});

/**
 * Builds the response the route would return for `input` with a successful
 * AI response that returns no findings and no steps. Uses the real
 * deterministic engine and the real assessScan.
 */
async function resultWithAiNoFindings(input: string): Promise<ScanResult> {
  const det = await runDeterministicChecks(input);
  return {
    timestamp: "2026-11-14T08:48:12.000Z",
    inputType: "message",
    ...assessScan(det, { unavailable: false, findings: [], recommendedSteps: [] }),
  };
}

describe("empty submit (card level)", () => {
  it("shows inline validation and never calls the API", () => {
    const f = fixedFetch(200, {});
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    typeValue(q(container).textarea, "   ");
    submit(q(container).form);
    expect(q(container).inputError.textContent).toBe(INPUT_REQUIRED_MESSAGE);
    expect(f.mock).not.toHaveBeenCalled();
    expect(container.querySelector("[data-scan-state]")!.getAttribute("data-scan-state")).toBe("idle");
    expect(q(container).status.textContent).toBe("");
  });
});

describe("loading indicator clears on every response", () => {
  it.each([
    ["error response", 500, { error: "internal_error" }],
    ["inline validation response", 400, { error: "input_required" }],
  ])("clears after an %s", async (_n, status, body) => {
    const f = fixedFetch(status, body);
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    typeValue(q(container).textarea, "some text");
    submit(q(container).form);
    expect(q(container).status.textContent).toBe(LOADING_TEXT);
    await flush();
    expect(q(container).status.textContent).toBe("");
  });
});

describe("primary controls are native and focusable (jsdom-level only)", () => {
  it("sample buttons, textarea, submit, view-report, new-investigation, copy, and download", async () => {
    const result = await resultWithAiNoFindings(SAMPLE_TRAPS[2].content);
    const f = fixedFetch(200, result);
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);

    const check = (controls: HTMLElement[]) => {
      for (const el of controls) {
        expect(["BUTTON", "TEXTAREA"]).toContain(el.tagName);
        const tabindex = el.getAttribute("tabindex");
        expect(tabindex === null || Number(tabindex) >= 0).toBe(true);
        expect((el as HTMLButtonElement).disabled).toBe(false);
        el.focus();
        expect(document.activeElement).toBe(el);
      }
    };
    const byText = (t: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === t)!;

    // Awaiting view: samples, textarea, submit.
    const awaiting = [...q(container).samples, q(container).textarea, container.querySelector('button[type="submit"]') as HTMLButtonElement];
    expect(awaiting).toHaveLength(5);
    check(awaiting);

    typeValue(q(container).textarea, "anything");
    submit(q(container).form);
    await flush();

    // Revealed view: report and new-investigation actions.
    const revealed = [byText(VIEW_REPORT_LABEL), byText(NEW_INVESTIGATION_LABEL)];
    expect(revealed.every(Boolean)).toBe(true);
    check(revealed);

    // Preserved view: copy, download, back, new investigation.
    click(byText(VIEW_REPORT_LABEL));
    const preserved = [
      ...([...container.querySelectorAll('[data-section="report-export"] button')] as HTMLButtonElement[]),
      byText(BACK_TO_ASSESSMENT_LABEL),
      byText(NEW_INVESTIGATION_LABEL),
    ];
    expect(preserved).toHaveLength(4);
    check(preserved);
  });
});

describe("Legitimate Bank Alert end to end (mocked AI success with no findings)", () => {
  it("shows a low-risk result, no AI findings, and independent-verification guidance", async () => {
    const bank = SAMPLE_TRAPS.find((s) => s.label === "Legitimate Bank Alert")!;
    const result = await resultWithAiNoFindings(bank.content);
    const f = fixedFetch(200, result);
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);

    click(q(container).samples.find((b) => b.textContent === bank.label)!);
    expect(q(container).textarea.value).toBe(bank.content);
    submit(q(container).form);
    await flush();
    expect(JSON.parse(String(f.mock.mock.calls[0][1]?.body))).toEqual({ input: bank.content });

    // Low-risk tier, score 0, never "safe" wording in the verdict.
    expect(container.querySelector("[data-tier]")!.textContent).toBe("Low risk — still verify independently");
    expect(container.querySelector("[data-score]")!.textContent).toBe("0");
    expect(container.querySelector('[data-section="verdict"]')!.textContent).not.toMatch(/safe/i);

    // No fabricated AI findings.
    expect(container.querySelector("[data-ai-finding]")).toBeNull();
    expect(container.querySelector('[data-ai-state="no-findings"]')!.textContent).toBe(AI_NO_FINDINGS_NOTICE);

    // Independent-verification guidance (fallback steps, since AI returned none).
    expect(container.querySelector("[data-step-source]")!.getAttribute("data-step-source")).toBe("standard");
    const steps = [...container.querySelectorAll('[data-section="recommended-steps"] li')].map((li) => li.textContent);
    expect(steps).toEqual([...FALLBACK_VERIFICATION_STEPS]);
    expect(steps[0]).toBe("Verify the sender through an independently obtained contact method.");
  });

  it("renders every required section and sub-area heading", async () => {
    const result = await resultWithAiNoFindings(SAMPLE_TRAPS[2].content);
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: fixedFetch(200, result).fetchImpl }} />);
    typeValue(q(container).textarea, "anything");
    submit(q(container).form);
    await flush();
    const h2 = [...container.querySelectorAll("[data-results] h2")].map((h) => h.textContent);
    expect(h2).toEqual([VERDICT_HEADING, VERIFIED_CHECKS_HEADING, AI_HEADING, RECOMMENDED_STEPS_HEADING]);
    const h3 = [...container.querySelectorAll('[data-section="verified-checks"] h3')].map((h) => h.textContent);
    expect(h3).toEqual([FINDINGS_HEADING, INFORMATIONAL_HEADING, NOT_PERFORMED_HEADING]);
  });
});
