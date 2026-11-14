import { afterEach, describe, expect, it, vi } from "vitest";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS, SCAN_CLIENT_TIMEOUT_MS } from "@/lib/constants";
import type { CompleteScanResult, IncompleteScanResult } from "@/lib/types";
import { isScanResult, requestScan } from "./scanClient";

const COMPLETE: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12.000Z",
  inputType: "message",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 0,
  severityTier: "Low risk — still verify independently",
  waxSealColor: "#059669",
  deterministicFindings: [],
  aiFindings: [],
  recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
  aiAvailable: false,
  aiUnavailableReason: "timeout",
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

function respond(status: number, body: unknown, { badJson = false } = {}) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
    status,
    json: async () => {
      if (badJson) throw new SyntaxError("Unexpected token");
      return body;
    },
  }) as unknown as Response);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("requestScan", () => {
  it("POSTs { input } as JSON to /api/scan with no-store", async () => {
    const fetchImpl = respond(200, COMPLETE);
    await requestScan("hello", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/scan");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ input: "hello" });
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("200 with a complete or incomplete ScanResult is success", async () => {
    expect(await requestScan("x", { fetchImpl: respond(200, COMPLETE) })).toEqual({ ok: true, result: COMPLETE });
    expect(await requestScan("x", { fetchImpl: respond(200, INCOMPLETE) })).toEqual({ ok: true, result: INCOMPLETE });
  });

  it("maps 400 input_required and input_too_long to inline kinds", async () => {
    expect(await requestScan("x", { fetchImpl: respond(400, { error: "input_required" }) })).toEqual({ ok: false, kind: "input_required" });
    expect(await requestScan("x", { fetchImpl: respond(400, { error: "input_too_long" }) })).toEqual({ ok: false, kind: "input_too_long" });
  });

  it.each([
    ["400 invalid_request", 400, { error: "invalid_request" }],
    ["500 internal_error", 500, { error: "internal_error" }],
    ["429", 429, { error: "rate_limited" }],
    ["502", 502, {}],
    ["404", 404, { error: "input_required" }],
    ["200 malformed body", 200, { hello: "world" }],
    ["200 complete without score", 200, { ...COMPLETE, riskScore: null }],
    ["200 incomplete with a score", 200, { ...INCOMPLETE, riskScore: 5 }],
  ])("%s is retryable", async (_name, status, body) => {
    expect(await requestScan("x", { fetchImpl: respond(status, body) })).toEqual({ ok: false, kind: "retryable" });
  });

  it("non-JSON responses are retryable", async () => {
    expect(await requestScan("x", { fetchImpl: respond(200, null, { badJson: true }) })).toEqual({ ok: false, kind: "retryable" });
    expect(await requestScan("x", { fetchImpl: respond(500, null, { badJson: true }) })).toEqual({ ok: false, kind: "retryable" });
  });

  it("network failure is retryable and exposes no error text", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch: provider secret detail");
    });
    const out = await requestScan("x", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(out).toEqual({ ok: false, kind: "retryable" });
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  it("aborts the request at the 45-second default timeout and returns retryable", async () => {
    vi.useFakeTimers();
    expect(SCAN_CLIENT_TIMEOUT_MS).toBe(45_000);
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const pending = requestScan("x", { fetchImpl });
    await vi.advanceTimersByTimeAsync(SCAN_CLIENT_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, kind: "retryable" });
  });

  it("clears the timeout after a response", async () => {
    vi.useFakeTimers();
    await requestScan("x", { fetchImpl: respond(200, COMPLETE) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a caller abort signal cancels the request", async () => {
    const outer = new AbortController();
    let inner: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          inner = init?.signal ?? undefined;
          inner?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const pending = requestScan("x", { fetchImpl, signal: outer.signal });
    outer.abort();
    expect(inner?.aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, kind: "retryable" });
  });
});

describe("isScanResult", () => {
  it("accepts valid complete and incomplete results and rejects malformed ones", () => {
    expect(isScanResult(COMPLETE)).toBe(true);
    expect(isScanResult(INCOMPLETE)).toBe(true);
    expect(isScanResult(null)).toBe(false);
    expect(isScanResult([])).toBe(false);
    expect(isScanResult({ ...COMPLETE, deterministicStatus: "partial" })).toBe(false);
    expect(isScanResult({ ...COMPLETE, riskScore: 101 })).toBe(false);
    expect(isScanResult({ ...COMPLETE, severityTier: "Verified Safe" })).toBe(false);
    expect(isScanResult({ ...COMPLETE, deterministicFindings: ["x"] })).toBe(false);
    expect(isScanResult({ ...COMPLETE, recommendedSteps: [1] })).toBe(false);
    expect(isScanResult({ ...INCOMPLETE, incompleteChecks: [] })).toBe(false);
  });
});
