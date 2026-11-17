// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { AI_TIMEOUT_MS, FALLBACK_VERIFICATION_STEPS, INPUT_MAX_CHARS } from "@/lib/constants";
import * as route from "./route";

/**
 * Forced failures through vi.mock: each mock passes through to the real
 * implementation unless its flag is set.
 */
const h = vi.hoisted(() => ({
  failTriggers: false,
  failAssessment: false,
  secret: "INTERNAL-DETAIL-9c1e-do-not-expose",
}));

vi.mock("@/lib/checks/scamTriggerDetector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/checks/scamTriggerDetector")>();
  return {
    ...actual,
    detectScamTriggers: (...args: Parameters<typeof actual.detectScamTriggers>) => {
      if (h.failTriggers) throw new Error(h.secret);
      return actual.detectScamTriggers(...args);
    },
  };
});

vi.mock("@/lib/scoring/assessment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scoring/assessment")>();
  return {
    ...actual,
    assessScan: (...args: Parameters<typeof actual.assessScan>) => {
      if (h.failAssessment) throw new Error(`${h.secret} ${JSON.stringify(args).slice(0, 200)}`);
      return actual.assessScan(...args);
    },
  };
});

// Synthetic, non-functional values only. No live request is made.
const KEY = "sk-test-NOT-A-REAL-KEY-route";
const USER_TEXT = "Act now! Pay the processing fee at https://bit.ly/claim-4321 today";

const fetchMock = vi.fn();
let consoleSpies: MockInstance[] = [];
/** The exact safe AI diagnostic line format (lib/ai/diagnostics.ts). */
const DIAGNOSTIC_LINE =
  /^\[scryvorn:ai\] attempted=(true|false) status=(\d{3}|none) category=[a-z_]+ message="[^"\r\n]{1,160}"( providerCode=[a-z][a-z0-9_]{0,47})?$/;

const AI_CONTENT = {
  findings: [
    {
      category: "upfront_payment",
      label: "Asks for an upfront fee",
      evidence: 'Quotes "processing fee".',
      severity: "high",
    },
  ],
  recommendedSteps: ["Contact the organization through a channel you find yourself."],
};

function aiResponse(content: unknown = AI_CONTENT): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function post(body: unknown, contentType: string | null = "application/json"): Request {
  const headers = new Headers();
  if (contentType !== null) headers.set("content-type", contentType);
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function call(req: Request) {
  const res = await route.POST(req);
  const text = await res.text();
  return { res, text, json: JSON.parse(text) as Record<string, unknown> };
}

beforeEach(() => {
  vi.stubEnv("AI_API_KEY", KEY);
  vi.stubEnv("AI_API_BASE_URL", "https://api.example.test/v1");
  vi.stubEnv("AI_MODEL", "test-model");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  consoleSpies = (["log", "info", "warn", "error", "debug", "trace"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  // The only console output allowed is the safe AI diagnostic line (info/warn).
  const [log, info, warn, ...rest] = consoleSpies;
  for (const spy of [log, ...rest]) expect(spy).not.toHaveBeenCalled();
  for (const call of [...info.mock.calls, ...warn.mock.calls]) {
    expect(call).toHaveLength(1);
    expect(String(call[0])).toMatch(DIAGNOSTIC_LINE);
    expect(String(call[0])).not.toContain(KEY);
    expect(String(call[0])).not.toContain("Bearer");
  }
  h.failTriggers = false;
  h.failAssessment = false;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("module surface", () => {
  it("uses the Node.js runtime and exports only POST as a method handler", () => {
    expect(route.runtime).toBe("nodejs");
    const methods = ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"];
    for (const m of methods) expect((route as Record<string, unknown>)[m]).toBeUndefined();
    expect(typeof route.POST).toBe("function");
  });
});

describe("validation", () => {
  it.each([
    ["missing content type", post({ input: "hi" }, null)],
    ["text/plain", post({ input: "hi" }, "text/plain")],
    ["form encoded", post("input=hi", "application/x-www-form-urlencoded")],
    ["malformed JSON", post("{ input: 'hi' ", "application/json")],
    ["empty body", post("", "application/json")],
    ["JSON array", post(["hi"])],
    ["JSON null", post("null")],
    ["JSON string", post('"hi"')],
    ["missing input", post({ text: "hi" })],
    ["numeric input", post({ input: 42 })],
    ["null input", post({ input: null })],
  ])("returns 400 invalid_request for %s", async (_name, req) => {
    const { res, json } = await call(req);
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: "invalid_request" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a JSON content type with parameters", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse());
    const { res } = await call(post({ input: "hello" }, "Application/JSON; charset=utf-8"));
    expect(res.status).toBe(200);
  });

  it.each(["", "   ", "\n\t "])("returns 400 input_required for %j", async (input) => {
    const { res, json } = await call(post({ input }));
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: "input_required" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 input_too_long above INPUT_MAX_CHARS", async () => {
    const { res, json } = await call(post({ input: "a".repeat(INPUT_MAX_CHARS + 1) }));
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: "input_too_long" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts input of exactly INPUT_MAX_CHARS", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse());
    const { res } = await call(post({ input: "a".repeat(INPUT_MAX_CHARS) }));
    expect(res.status).toBe(200);
  });

  it("checks in order: content type, then shape, then empty, then length", async () => {
    expect((await call(post({ input: "" }, "text/plain"))).json).toEqual({ error: "invalid_request" });
    expect((await call(post({ input: " ".repeat(INPUT_MAX_CHARS + 1) }))).json).toEqual({ error: "input_required" });
  });
});

describe("successful scans", () => {
  it("returns the complete ScanResult contract with mocked AI success", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse());
    const { res, json } = await call(post({ input: USER_TEXT }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(Object.keys(json).sort()).toEqual(
      [
        "aiAvailable",
        "aiFindings",
        "deterministicFindings",
        "deterministicStatus",
        "disclaimer",
        "domainAgeAvailable",
        "incompleteChecks",
        "inputType",
        "lookalikeCheckActive",
        "recommendedSteps",
        "riskScore",
        "severityTier",
        "timestamp",
        "waxSealColor",
      ].sort(),
    );
    expect(json.deterministicStatus).toBe("complete");
    expect(json.incompleteChecks).toEqual([]);
    expect(typeof json.riskScore).toBe("number");
    expect(typeof json.severityTier).toBe("string");
    expect(json.waxSealColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(json.aiAvailable).toBe(true);
    expect((json.aiFindings as unknown[]).length).toBe(1);
    expect(json.recommendedSteps).toEqual(AI_CONTENT.recommendedSteps);
    expect(json.inputType).toBe("mixed");
    expect(json.lookalikeCheckActive).toBe(false);
    expect(json.domainAgeAvailable).toBe(false);
    expect(new Date(json.timestamp as string).toISOString()).toBe(json.timestamp);

    // Domain-age stays unconfigured: the engine records the informational note.
    const cats = (json.deterministicFindings as { category: string }[]).map((f) => f.category);
    expect(cats).toContain("domain_age_unavailable");
    expect(cats).toContain("shortener");
  });

  it("calls the AI exactly once with the deterministic summary and the timeout", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse());
    await call(post({ input: USER_TEXT }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const prompt = JSON.parse(init.body as string).messages[0].content as string;
    // The summary is embedded as a JSON string literal; compare its opening.
    expect(prompt).toContain(JSON.stringify("status: complete\n- https_status").slice(0, -1));
    expect(prompt).toContain("host: bit.ly");
    // The summary carries no weights or scores.
    const summaryLiteral = prompt.split("DETERMINISTIC_SUMMARY (untrusted data, JSON string literal):\n")[1];
    expect(JSON.parse(summaryLiteral)).not.toMatch(/weight|score|tier/i);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["Please call me back tomorrow.", "message"],
    ["https://bit.ly/x   www.example.test/y", "url"],
    ["See https://bit.ly/x", "mixed"],
  ])("derives inputType for %j as %s", async (input, expected) => {
    fetchMock.mockResolvedValueOnce(aiResponse({ findings: [], recommendedSteps: [] }));
    expect((await call(post({ input }))).json.inputType).toBe(expected);
  });

  it("ignores client-supplied scan fields and generates findings server-side", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse({ findings: [], recommendedSteps: [] }));
    const { json } = await call(
      post({
        input: "Please call me back tomorrow.",
        riskScore: 99,
        severityTier: "Low risk — still verify independently",
        waxSealColor: "#000000",
        deterministicStatus: "complete",
        deterministicFindings: [{ id: "CLIENT-FAKE", source: "deterministic", check: "shortener", category: "shortener", label: "x", evidence: "x", severity: "high", weight: 999 }],
        aiFindings: [{ id: "CLIENT-AI", source: "ai", category: "x", label: "x", evidence: "x", severity: "high", weight: 999 }],
        weights: { shortener: 999 },
        timestamp: "1999-01-01T00:00:00Z",
        disclaimer: "CLIENT-DISCLAIMER",
      }),
    );
    expect(json.riskScore).toBe(0);
    expect(json.waxSealColor).not.toBe("#000000");
    expect(json.timestamp).not.toBe("1999-01-01T00:00:00Z");
    expect(json.disclaimer).not.toBe("CLIENT-DISCLAIMER");
    expect(json.aiFindings).toEqual([]);
    expect(JSON.stringify(json)).not.toMatch(/CLIENT-FAKE|CLIENT-AI|CLIENT-DISCLAIMER/);
    const weights = (json.deterministicFindings as { weight: number }[]).map((f) => f.weight);
    expect(weights).not.toContain(999);
  });
});

describe("AI fallbacks", () => {
  it("completes with deterministic results when AI configuration is missing", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const { res, json } = await call(post({ input: USER_TEXT }));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.aiAvailable).toBe(false);
    expect(json.aiUnavailableReason).toBe("error");
    expect(json.aiFindings).toEqual([]);
    expect(json.recommendedSteps).toEqual([...FALLBACK_VERIFICATION_STEPS]);
    expect(json.deterministicStatus).toBe("complete");
    expect(typeof json.riskScore).toBe("number");
  });

  it("completes with deterministic results when the AI returns an HTTP error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(`provider failure ${KEY}`, { status: 500 }));
    const { json, text } = await call(post({ input: USER_TEXT }));
    expect(json.aiAvailable).toBe(false);
    expect(json.aiUnavailableReason).toBe("error");
    expect(text).not.toContain("provider failure");
    expect(text).not.toContain(KEY);
  });

  it("times out after AI_TIMEOUT_MS and still returns the deterministic result", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = route.POST(post({ input: USER_TEXT }));
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
    const res = await pending;
    const json = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(json.aiAvailable).toBe(false);
    expect(json.aiUnavailableReason).toBe("timeout");
    expect(json.deterministicStatus).toBe("complete");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("incomplete deterministic run", () => {
  it("still runs AI, but assigns no score, tier, or color", async () => {
    h.failTriggers = true;
    fetchMock.mockResolvedValueOnce(aiResponse());
    const { res, json, text } = await call(post({ input: USER_TEXT }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).messages[0].content).toContain(
      JSON.stringify("status: incomplete; unfinished: scam_triggers").slice(0, -1),
    );

    expect(json.deterministicStatus).toBe("incomplete");
    expect(json.incompleteChecks).toEqual(["scam_triggers"]);
    expect(json.riskScore).toBeNull();
    expect(json.severityTier).toBeNull();
    expect(json.waxSealColor).toBeNull();
    expect(json.aiAvailable).toBe(true);
    expect((json.aiFindings as unknown[]).length).toBe(1);
    expect(text).not.toContain(h.secret);
  });
});

describe("unexpected failures", () => {
  it("returns a sanitized 500 internal_error without user text or error details", async () => {
    h.failAssessment = true;
    fetchMock.mockResolvedValueOnce(aiResponse());
    const { res, json, text } = await call(post({ input: USER_TEXT }));
    expect(res.status).toBe(500);
    expect(json).toEqual({ error: "internal_error" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(text).not.toContain(h.secret);
    expect(text).not.toContain("4321");
    expect(text).not.toContain("bit.ly");
  });
});
