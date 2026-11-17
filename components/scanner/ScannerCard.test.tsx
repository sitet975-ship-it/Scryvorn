/**
 * ScannerCard state-machine tests (jsdom, mocked fetch).
 *
 * Limits: these tests cannot verify real network behavior, real browser focus,
 * layout (including decorative overlap), or responsive rendering.
 * Page and layout composition tests live in app/pages.test.tsx.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { AiFinding } from "@/lib/ai/types";
import type { DeterministicFinding } from "@/lib/checks/types";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import { INCOMPLETE_ASSESSMENT_NOTICE, STEP_SOURCE_LABELS, buildEvidenceReport } from "@/lib/report/evidenceReport";
import { SAMPLE_TRAPS } from "@/lib/samples/sampleTraps";
import type { CompleteScanResult, IncompleteScanResult } from "@/lib/types";
import { click, render, submit, typeValue, type Rendered } from "@/test/dom";
import { AI_PARTIAL_EVIDENCE_NOTICE } from "./AiInterpretation";
import { COPY_LABEL, DOWNLOAD_LABEL } from "./EvidenceReportExport";
import { LOADING_TEXT } from "./LoadingState";
import {
  BACK_TO_ASSESSMENT_LABEL,
  EXAMINING_TITLE,
  GENERIC_SCAN_ERROR,
  HEADLINES,
  NEW_INVESTIGATION_LABEL,
  ScannerCard,
  VIEW_REPORT_LABEL,
} from "./ScannerCard";
import { INPUT_REQUIRED_MESSAGE, INPUT_TOO_LONG_MESSAGE } from "./ScannerInput";
import { PARTIAL_FINDINGS_NOTICE } from "./VerifiedChecks";

const TRIGGER: DeterministicFinding = {
  id: "scam_trigger:urgency_pressure",
  source: "deterministic",
  check: "scam_triggers",
  category: "urgency_pressure",
  label: "urgency pressure",
  evidence: 'Matched urgency pressure phrase "act now".',
  matchedText: "act now",
  severity: "medium",
  weight: 12,
};

const AI: AiFinding = {
  id: "ai:0",
  source: "ai",
  category: "pressure",
  label: "Time pressure",
  evidence: "Says act now",
  severity: "high",
  weight: 25,
};

const COMPLETE: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12.000Z",
  inputType: "message",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 37,
  severityTier: "Low risk — still verify independently",
  waxSealColor: "#059669",
  deterministicFindings: [TRIGGER],
  aiFindings: [AI],
  recommendedSteps: ["Call the sender back using a number you already trust."],
  aiAvailable: true,
  lookalikeCheckActive: false,
  domainAgeAvailable: false,
  disclaimer: ADVISORY_DISCLAIMER,
};

const AI_TIMEOUT: CompleteScanResult = {
  ...COMPLETE,
  riskScore: 12,
  aiFindings: [],
  recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
  aiAvailable: false,
  aiUnavailableReason: "timeout",
};

const AI_ERROR: CompleteScanResult = { ...AI_TIMEOUT, aiUnavailableReason: "error" };

const INCOMPLETE: IncompleteScanResult = {
  ...COMPLETE,
  deterministicStatus: "incomplete",
  incompleteChecks: ["scam_triggers"],
  riskScore: null,
  severityTier: null,
  waxSealColor: null,
};

type Deferred = { resolve: (status: number, body: unknown) => void; reject: (e: unknown) => void; init?: RequestInit };

/** fetch mock whose responses are released one at a time by the test. */
function controlledFetch() {
  const calls: Deferred[] = [];
  const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((res, rej) => {
      const d: Deferred = {
        init,
        resolve: (status, body) => res({ status, json: async () => body } as unknown as Response),
        reject: rej,
      };
      init?.signal?.addEventListener("abort", () => rej(new DOMException("Aborted", "AbortError")));
      calls.push(d);
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, mock: fetchImpl };
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
  vi.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function ui(c: HTMLElement) {
  return {
    card: c.querySelector("[data-scan-state]") as HTMLElement,
    textarea: c.querySelector("textarea")!,
    form: c.querySelector("form")!,
    submitButton: c.querySelector('button[type="submit"]') as HTMLButtonElement,
    status: c.querySelector('[role="status"]')!,
    inputError: c.querySelector("form p[aria-live]")!,
    scanError: c.querySelector("[data-scan-error]")!,
    results: c.querySelector("[data-results]"),
    sampleButtons: [...c.querySelectorAll('[role="group"] button')] as HTMLButtonElement[],
    exportButtons: [...c.querySelectorAll('[data-section="report-export"] button')] as HTMLButtonElement[],
    title: c.querySelector("h1")!,
    view: (c.querySelector("[data-view]") as HTMLElement).dataset.view,
  };
}

/** Clicks a button by its visible text (arrows included). */
function press(c: HTMLElement, label: string) {
  const b = [...c.querySelectorAll("button")].find((x) => x.textContent === label);
  if (!b) throw new Error(`button not found: ${label}`);
  click(b as HTMLButtonElement);
}

async function scanWith(c: HTMLElement, calls: Deferred[], text: string, status: number, body: unknown) {
  typeValue(ui(c).textarea, text);
  submit(ui(c).form);
  await act(async () => {
    calls[calls.length - 1].resolve(status, body);
  });
  await flush();
}

describe("ScannerCard state machine", () => {
  it("starts in the awaiting view: no results, no score, and no export offered before a scan", () => {
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: controlledFetch().fetchImpl }} />);
    const u = ui(container);
    expect(u.card.dataset.scanState).toBe("idle");
    expect(u.view).toBe("awaiting");
    expect(u.title.textContent).toBe(HEADLINES.awaiting.title);
    expect(u.results).toBeNull();
    expect(container.querySelector("[data-score], [data-tier], [data-verdict]")).toBeNull();
    // Req 9.5 (revised): copy/download are not offered until a scan completes.
    expect(u.exportButtons).toHaveLength(0);
  });

  it("uses SAMPLE_TRAPS by default and a sample replaces the input", () => {
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: controlledFetch().fetchImpl }} />);
    const u = ui(container);
    expect(u.sampleButtons.map((b) => b.textContent)).toEqual(SAMPLE_TRAPS.map((s) => s.label));
    click(u.sampleButtons[2]);
    expect(ui(container).textarea.value).toBe(SAMPLE_TRAPS[2].content);
  });

  it("loading: shows LoadingState, keeps the input, disables submit and samples", () => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    typeValue(ui(container).textarea, "check this");
    submit(ui(container).form);
    const u = ui(container);
    expect(u.card.dataset.scanState).toBe("loading");
    expect(u.status.textContent).toBe(LOADING_TEXT);
    expect(u.textarea.value).toBe("check this");
    expect(u.submitButton.disabled).toBe(true);
    expect(u.sampleButtons.every((b) => b.disabled)).toBe(true);
    expect(JSON.parse(String(f.calls[0].init?.body))).toEqual({ input: "check this" });
    // Examining view only while the real request is in flight; no score shown.
    expect(u.view).toBe("examining");
    expect(container.textContent).toContain(EXAMINING_TITLE);
    expect(container.querySelector('[data-decorative="lab-energy"]')).not.toBeNull();
    expect(container.querySelector("[data-score], [data-tier]")).toBeNull();
  });

  it("success (complete, AI available): results in the required order, AI-sourced steps, export enabled", async () => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "check this", 200, COMPLETE);
    const u = ui(container);
    expect(u.card.dataset.scanState).toBe("success");
    expect(u.view).toBe("revealed");
    expect(u.title.textContent).toBe(HEADLINES.revealed.title);
    expect(document.activeElement).toBe(u.title); // focus moves to the new view
    expect(u.status.textContent).toBe("");
    const order = [...container.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"));
    expect(order).toEqual(["verdict", "verified-checks", "ai-interpretation", "recommended-steps"]);
    expect(container.querySelector('[data-verdict="complete"]')).not.toBeNull();
    // Tier and score come from the real result, not fixed copy.
    expect(container.querySelector("[data-tier]")!.textContent).toBe(COMPLETE.severityTier);
    expect(container.querySelector("[data-score]")!.textContent).toBe(String(COMPLETE.riskScore));
    expect(container.querySelector('[data-ai-state="findings"]')).not.toBeNull();
    expect(container.querySelector("[data-step-source]")!.getAttribute("data-step-source")).toBe("ai");
    expect(u.scanError.textContent).toBe("");

    // Evidence preserved: the exact Evidence_Report text with enabled real export controls.
    press(container, VIEW_REPORT_LABEL);
    const r = ui(container);
    expect(r.view).toBe("preserved");
    expect(r.title.textContent).toBe(HEADLINES.preserved.title);
    expect(container.querySelector("[data-report-text]")!.textContent).toBe(buildEvidenceReport(COMPLETE));
    expect(r.exportButtons.map((b) => b.textContent)).toEqual([COPY_LABEL, DOWNLOAD_LABEL]);
    expect(r.exportButtons.every((b) => !b.disabled)).toBe(true);

    // Back to the assessment, then a new investigation keeps the input.
    press(container, BACK_TO_ASSESSMENT_LABEL);
    expect(ui(container).view).toBe("revealed");
    press(container, NEW_INVESTIGATION_LABEL);
    const n = ui(container);
    expect(n.view).toBe("awaiting");
    expect(n.textarea.value).toBe("check this");
    expect(document.activeElement).toBe(n.textarea);
  });

  it.each([
    ["timeout", AI_TIMEOUT, "AI analysis unavailable (the AI service did not respond in time)."],
    ["error", AI_ERROR, "AI analysis unavailable (the AI service returned an error or an unusable response)."],
  ])("AI %s is a success state handled by AiInterpretation, with fallback steps", async (_n, body, notice) => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "check this", 200, body);
    expect(ui(container).card.dataset.scanState).toBe("success");
    expect(container.querySelector('[data-ai-state="unavailable"]')!.textContent).toBe(notice);
    expect(container.querySelector("[data-step-source]")!.getAttribute("data-step-source")).toBe("standard");
    expect(container.textContent).toContain(STEP_SOURCE_LABELS.standard);
    expect(ui(container).scanError.textContent).toBe("");
  });

  it("success (incomplete run): neutral panel, partial notes, export enabled, no duplicate banner", async () => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "check this", 200, INCOMPLETE);
    expect(ui(container).card.dataset.scanState).toBe("success");
    expect(container.querySelector('[data-verdict="incomplete"]')).not.toBeNull();
    expect(container.querySelector("[data-wax-seal]")).toBeNull();
    expect(container.textContent).toContain(PARTIAL_FINDINGS_NOTICE);
    expect(container.textContent).toContain(AI_PARTIAL_EVIDENCE_NOTICE);
    expect(container.textContent!.split(INCOMPLETE_ASSESSMENT_NOTICE)).toHaveLength(2); // exactly once
    expect(container.querySelector("[data-score], [data-tier]")).toBeNull();
    press(container, VIEW_REPORT_LABEL);
    const r = ui(container);
    expect(r.exportButtons).toHaveLength(2);
    expect(r.exportButtons.every((b) => !b.disabled)).toBe(true);
    // The report explains the incomplete assessment.
    expect(container.querySelector("[data-report-text]")!.textContent).toContain(INCOMPLETE_ASSESSMENT_NOTICE);
  });

  it("a new scan immediately clears the previous result and keeps the input", async () => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "first", 200, COMPLETE);
    expect(ui(container).results).not.toBeNull();
    press(container, NEW_INVESTIGATION_LABEL);
    expect(ui(container).textarea.value).toBe("first");
    typeValue(ui(container).textarea, "second");
    submit(ui(container).form);
    const u = ui(container);
    expect(u.card.dataset.scanState).toBe("loading");
    expect(u.results).toBeNull();
    expect(u.exportButtons).toHaveLength(0);
    expect(u.textarea.value).toBe("second");
  });

  it.each([
    ["input_required", INPUT_REQUIRED_MESSAGE],
    ["input_too_long", INPUT_TOO_LONG_MESSAGE],
  ])("400 %s is shown inline by ScannerInput, input kept, cleared on edit", async (code, message) => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "server says no", 400, { error: code });
    let u = ui(container);
    expect(u.card.dataset.scanState).toBe("error");
    expect(u.inputError.textContent).toBe(message);
    expect(u.textarea.getAttribute("aria-invalid")).toBe("true");
    expect(u.scanError.textContent).toBe("");
    expect(u.textarea.value).toBe("server says no");
    typeValue(u.textarea, "server says no!");
    u = ui(container);
    expect(u.inputError.textContent).toBe("");
    expect(u.card.dataset.scanState).toBe("idle");
  });

  it.each([
    ["400 invalid_request", 400, { error: "invalid_request" }],
    ["500 internal_error", 500, { error: "internal_error" }],
    ["503", 503, { message: "provider stack trace: secret-detail" }],
    ["malformed 200", 200, { nope: true }],
  ])("%s shows one generic retryable message without exposing the body", async (_n, status, body) => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "keep me", status, body);
    const u = ui(container);
    expect(u.card.dataset.scanState).toBe("error");
    expect(u.scanError.textContent).toBe(GENERIC_SCAN_ERROR);
    expect(u.scanError.getAttribute("aria-live")).toBe("polite");
    expect(u.scanError.getAttribute("role")).toBeNull();
    expect(u.scanError.className).toContain("text-scry-ivory");
    expect(u.scanError.className).not.toContain("text-scry-danger");
    expect(u.view).toBe("awaiting");
    expect(u.textarea.value).toBe("keep me");
    expect(container.textContent).not.toContain("secret-detail");
    expect(container.textContent).not.toContain("internal_error");
  });

  it("network failure is retryable, and a retry can succeed", async () => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    typeValue(ui(container).textarea, "retry me");
    submit(ui(container).form);
    await act(async () => {
      f.calls[0].reject(new TypeError("Failed to fetch"));
    });
    await flush();
    expect(ui(container).scanError.textContent).toBe(GENERIC_SCAN_ERROR);
    submit(ui(container).form);
    expect(ui(container).scanError.textContent).toBe("");
    await act(async () => {
      f.calls[1].resolve(200, COMPLETE);
    });
    await flush();
    expect(ui(container).card.dataset.scanState).toBe("success");
    expect(JSON.parse(String(f.calls[1].init?.body))).toEqual({ input: "retry me" });
  });

  it("client timeout aborts the request and shows the retryable error", async () => {
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl, timeoutMs: 20 }} />);
    typeValue(ui(container).textarea, "slow");
    submit(ui(container).form);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    await flush();
    expect(f.calls[0].init?.signal?.aborted).toBe(true);
    expect(ui(container).card.dataset.scanState).toBe("error");
    expect(ui(container).scanError.textContent).toBe(GENERIC_SCAN_ERROR);
    expect(ui(container).textarea.value).toBe("slow");
  });

  it("unmounting during a scan aborts the request", () => {
    const f = controlledFetch();
    const r = render(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    typeValue(ui(r.container).textarea, "bye");
    submit(ui(r.container).form);
    r.unmount();
    expect(f.calls[0].init?.signal?.aborted).toBe(true);
  });
});

describe("no persistence", () => {
  afterEach(() => {
    // Remove the instance-level cookie spy so the prototype accessor applies again.
    delete (document as unknown as { cookie?: string }).cookie;
  });

  it("a full scan writes nothing to Web Storage or cookies", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const cookieSet = vi.fn();
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: cookieSet });
    const idbOpen = typeof indexedDB !== "undefined" ? vi.spyOn(indexedDB, "open") : null;
    const f = controlledFetch();
    const { container } = mount(<ScannerCard requestOptions={{ fetchImpl: f.fetchImpl }} />);
    await scanWith(container, f.calls, "private text https://x.example", 200, COMPLETE);
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    if (idbOpen) expect(idbOpen).not.toHaveBeenCalled();
  });

  it("scan-flow sources reference no persistence API", () => {
    const files = [
      "components/scanner/ScannerCard.tsx",
      "components/scanner/ResultsPanel.tsx",
      "components/scanner/EvidenceReportView.tsx",
      "lib/scan/scanClient.ts",
      "app/page.tsx",
      "app/inspect/page.tsx",
      "app/layout.tsx",
      "components/landing/LandingPage.tsx",
      "components/shell/AppShell.tsx",
      "components/scanner/RecommendedSteps.tsx",
      "lib/samples/sampleTraps.ts",
    ];
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src, file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|caches\.open|showSaveFilePicker/);
    }
  });
});


