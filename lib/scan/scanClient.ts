import { SCAN_CLIENT_TIMEOUT_MS, SEVERITY_TIERS } from "@/lib/constants";
import type { ScanResult } from "@/lib/types";

/**
 * Browser-side client for POST /api/scan.
 *
 * Outcomes:
 * - 200 with a structurally valid ScanResult -> { ok: true, result }. This
 *   includes AI-unavailable and incomplete deterministic results.
 * - 400 { error: "input_required" | "input_too_long" } -> that kind (shown
 *   inline by ScannerInput).
 * - Everything else -> "retryable": 400 invalid_request, 500 internal_error,
 *   other HTTP statuses (including 429), network failure, non-JSON or
 *   malformed bodies, and an aborted/timed-out request.
 *
 * Never returns response bodies, provider errors, or exception text. Stores
 * nothing (no Web Storage, IndexedDB, cookies, or files) and logs nothing.
 */
export type ScanFailureKind = "input_required" | "input_too_long" | "retryable";
export type ScanOutcome = { ok: true; result: ScanResult } | { ok: false; kind: ScanFailureKind };

export interface ScanRequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Caller cancellation (for example on unmount). */
  signal?: AbortSignal;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isObjectArray = (v: unknown) => Array.isArray(v) && v.every(isObject);

/** Structural check so the UI never renders a malformed body as a result. */
export function isScanResult(v: unknown): v is ScanResult {
  if (!isObject(v)) return false;
  if (typeof v.timestamp !== "string" || typeof v.disclaimer !== "string") return false;
  if (v.inputType !== "message" && v.inputType !== "url" && v.inputType !== "mixed") return false;
  if (!isObjectArray(v.deterministicFindings) || !isObjectArray(v.aiFindings)) return false;
  if (!Array.isArray(v.recommendedSteps) || !v.recommendedSteps.every((s) => typeof s === "string")) return false;
  if (!Array.isArray(v.incompleteChecks) || !v.incompleteChecks.every((s) => typeof s === "string")) return false;
  if (typeof v.aiAvailable !== "boolean") return false;
  if (typeof v.lookalikeCheckActive !== "boolean" || typeof v.domainAgeAvailable !== "boolean") return false;
  if (v.deterministicStatus === "complete") {
    return (
      v.incompleteChecks.length === 0 &&
      typeof v.riskScore === "number" &&
      Number.isInteger(v.riskScore) &&
      v.riskScore >= 0 &&
      v.riskScore <= 100 &&
      SEVERITY_TIERS.some((t) => t.tier === v.severityTier) &&
      typeof v.waxSealColor === "string"
    );
  }
  if (v.deterministicStatus === "incomplete") {
    return (
      v.incompleteChecks.length > 0 &&
      v.riskScore === null &&
      v.severityTier === null &&
      v.waxSealColor === null
    );
  }
  return false;
}

export async function requestScan(input: string, opts: ScanRequestOptions = {}): Promise<ScanOutcome> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? SCAN_CLIENT_TIMEOUT_MS);

  try {
    const response = await fetchImpl("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, kind: "retryable" };
    }

    if (response.status === 200) {
      return isScanResult(body) ? { ok: true, result: body } : { ok: false, kind: "retryable" };
    }
    if (response.status === 400 && isObject(body)) {
      if (body.error === "input_required") return { ok: false, kind: "input_required" };
      if (body.error === "input_too_long") return { ok: false, kind: "input_too_long" };
    }
    return { ok: false, kind: "retryable" };
  } catch {
    // Network failure, abort, or timeout.
    return { ok: false, kind: "retryable" };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
