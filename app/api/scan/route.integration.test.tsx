// @vitest-environment node
/**
 * Task 11.1 route integration tests that add to route.test.ts (which already
 * covers the full ScanResult contract, AI HTTP error, AI timeout, missing AI
 * configuration, and no console output on any path).
 *
 * AI behavior is mocked at the network boundary (global fetch); the real
 * runAiInterpretation runs. The deterministic engine and AI module are
 * wrapped only to record call order.
 *
 * Domain age: the route injects no domain-age service, so route-level
 * enrichment is NOT tested here. Configured/unconfigured/failed behavior is
 * covered by lib/checks/deterministicEngine.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import { AI_TIMEOUT_MS } from "@/lib/constants";
import { buildEvidenceReport } from "@/lib/report/evidenceReport";
import { computeRiskScore } from "@/lib/scoring/riskScore";
import type { ScanResult } from "@/lib/types";
import { AiInterpretation } from "@/components/scanner/AiInterpretation";

const h = vi.hoisted(() => ({
  events: [] as string[],
  fsWrites: [] as string[],
}));

vi.mock("@/lib/checks/deterministicEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/checks/deterministicEngine")>();
  return {
    ...actual,
    runDeterministicChecks: async (...args: Parameters<typeof actual.runDeterministicChecks>) => {
      h.events.push("deterministic:start");
      const r = await actual.runDeterministicChecks(...args);
      h.events.push("deterministic:end");
      return r;
    },
  };
});

vi.mock("@/lib/ai/aiInterpretation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/aiInterpretation")>();
  return {
    ...actual,
    runAiInterpretation: async (...args: Parameters<typeof actual.runAiInterpretation>) => {
      h.events.push("ai:start");
      const r = await actual.runAiInterpretation(...args);
      h.events.push("ai:end");
      return r;
    },
  };
});

/** Records any write-style call made through the fs modules during a scan. */
function recordingFs(name: string) {
  return async (importOriginal: () => Promise<Record<string, unknown>>) => {
    const actual = await importOriginal();
    const wrapped: Record<string, unknown> = { ...actual };
    for (const fn of [
      "writeFile", "writeFileSync", "appendFile", "appendFileSync",
      "createWriteStream", "mkdir", "mkdirSync", "copyFile", "copyFileSync", "rename", "renameSync",
    ]) {
      const original = actual[fn];
      if (typeof original === "function") {
        wrapped[fn] = (...args: unknown[]) => {
          h.fsWrites.push(`${name}.${fn}`);
          return (original as (...a: unknown[]) => unknown)(...args);
        };
      }
    }
    return { ...wrapped, default: { ...(actual.default as object), ...wrapped } };
  };
}
vi.mock("node:fs", recordingFs("node:fs"));
vi.mock("fs", recordingFs("fs"));
vi.mock("node:fs/promises", recordingFs("node:fs/promises"));
vi.mock("fs/promises", recordingFs("fs/promises"));

// Imported after the mocks are registered (vi.mock is hoisted).
import * as route from "./route";

// Synthetic values only; no live request is made.
const KEY = "sk-test-NOT-A-REAL-KEY-route";
const MARKER = "ZZ-PRIVATE-USER-MARKER-4821";
const USER_TEXT = `Act now! Pay the processing fee at https://bit.ly/claim-${MARKER} today`;

const fetchMock = vi.fn();
let consoleSpies: MockInstance[] = [];
/** The exact safe AI diagnostic line format (lib/ai/diagnostics.ts). */
const DIAGNOSTIC_LINE =
  /^\[scryvorn:ai\] attempted=(true|false) status=(\d{3}|none) category=[a-z_]+ message="[^"\r\n]{1,160}"( providerCode=[a-z][a-z0-9_]{0,47})?$/;
let stdoutSpy: MockInstance;
let stderrSpy: MockInstance;

function aiResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const AI_HIGH = {
  findings: [{ category: "upfront_payment", label: "Asks for a fee", evidence: 'Quotes "processing fee".', severity: "high" }],
  recommendedSteps: ["Contact the organization through a channel you find yourself."],
};

function post(input: string): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  });
}

async function scan(input = USER_TEXT): Promise<{ res: Response; text: string; json: ScanResult }> {
  const res = await route.POST(post(input));
  const text = await res.text();
  return { res, text, json: JSON.parse(text) as ScanResult };
}

/** Deterministic-only score computed independently of the route. */
async function expectedDeterministicScore(input = USER_TEXT): Promise<number> {
  const det = await runDeterministicChecks(input);
  return computeRiskScore(det.findings, []);
}

/** Storage-like globals that record any use. */
function spyStorage() {
  const store = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
  return store;
}

beforeEach(() => {
  h.events.length = 0;
  h.fsWrites.length = 0;
  vi.stubEnv("AI_API_KEY", KEY);
  vi.stubEnv("AI_API_BASE_URL", "https://api.example.test/v1");
  vi.stubEnv("AI_MODEL", "test-model");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  consoleSpies = (["log", "info", "warn", "error", "debug", "trace"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
  stdoutSpy = vi.spyOn(process.stdout, "write");
  stderrSpy = vi.spyOn(process.stderr, "write");
});

afterEach(() => {
  // The only console output allowed is the safe AI diagnostic line (info/warn),
  // and it never carries the key or the user's text.
  const [log, info, warn, ...rest] = consoleSpies;
  for (const spy of [log, ...rest]) expect(spy).not.toHaveBeenCalled();
  for (const call of [...info.mock.calls, ...warn.mock.calls]) {
    expect(call).toHaveLength(1);
    const line = String(call[0]);
    expect(line).toMatch(DIAGNOSTIC_LINE);
    for (const secret of [KEY, MARKER, "Bearer", "processing fee"]) expect(line).not.toContain(secret);
  }
  // Nothing written to stdout/stderr may carry the user's text.
  for (const call of [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls]) {
    expect(String(call[0])).not.toContain(MARKER);
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pipeline order", () => {
  it("deterministic checks complete before runAiInterpretation starts", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse(AI_HIGH));
    const { res } = await scan();
    expect(res.status).toBe(200);
    expect(h.events).toEqual(["deterministic:start", "deterministic:end", "ai:start", "ai:end"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validation failures run neither stage", async () => {
    const res = await route.POST(post("   "));
    expect(res.status).toBe(400);
    expect(h.events).toEqual([]);
  });
});

describe("single well-formed response", () => {
  it("returns exactly one JSON ScanResult whose score matches its own findings", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse(AI_HIGH));
    const { res, text, json } = await scan();
    expect(res.status).toBe(200);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.trim().startsWith("{") && text.trim().endsWith("}")).toBe(true);
    expect(json.deterministicStatus).toBe("complete");
    if (json.deterministicStatus !== "complete") throw new Error("unreachable");
    expect(json.riskScore).toBe(computeRiskScore(json.deterministicFindings, json.aiFindings));
    // The report builder accepts the response as-is.
    expect(() => buildEvidenceReport(json)).not.toThrow();
  });
});

describe("AI unavailable: deterministic-only results", () => {
  it("AI timeout: deterministic findings kept, score from deterministic findings alone, notice shown", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = route.POST(post(USER_TEXT));
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
    const res = await pending;
    const json = JSON.parse(await res.text()) as ScanResult;
    vi.useRealTimers();

    expect(res.status).toBe(200);
    expect(json.aiAvailable).toBe(false);
    expect(json.aiUnavailableReason).toBe("timeout");
    expect(json.aiFindings).toEqual([]);
    expect(json.deterministicFindings.length).toBeGreaterThan(0);
    expect(json.riskScore).toBe(await expectedDeterministicScore());

    const notice = "AI analysis unavailable (the AI service did not respond in time).";
    expect(renderToStaticMarkup(<AiInterpretation result={json} />)).toContain(notice);
    expect(buildEvidenceReport(json)).toContain(notice);
  });

  it("AI error: deterministic findings kept, score from deterministic findings alone, notice shown", async () => {
    fetchMock.mockResolvedValueOnce(new Response("upstream failure", { status: 502 }));
    const { json, text } = await scan();
    expect(json.aiAvailable).toBe(false);
    expect(json.aiUnavailableReason).toBe("error");
    expect(json.aiFindings).toEqual([]);
    expect(json.riskScore).toBe(await expectedDeterministicScore());
    expect(text).not.toContain("upstream failure");
    const notice = "AI analysis unavailable (the AI service returned an error or an unusable response).";
    expect(renderToStaticMarkup(<AiInterpretation result={json} />)).toContain(notice);
  });

  it("an AI result would change the score, so the deterministic-only equality is meaningful", async () => {
    const detOnly = await expectedDeterministicScore();
    fetchMock.mockResolvedValueOnce(aiResponse(AI_HIGH));
    const { json } = await scan();
    expect(json.riskScore).toBeGreaterThan(detOnly);
    expect(detOnly).toBe(39); // shortener 15 + two scam triggers 12 + 12 (synthetic input)
  });
});

describe("no persistence and no logging", () => {
  it("a full scan calls no stubbed Web Storage, IndexedDB, or cookie API and no fs write recorded in the test module graph", async () => {
    const local = spyStorage();
    const session = spyStorage();
    const idb = { open: vi.fn(), deleteDatabase: vi.fn() };
    const cookieSet = vi.fn();
    const doc = {};
    Object.defineProperty(doc, "cookie", { get: () => "", set: cookieSet });
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("indexedDB", idb);
    vi.stubGlobal("document", doc);

    fetchMock.mockResolvedValueOnce(aiResponse(AI_HIGH));
    const { res } = await scan();
    expect(res.status).toBe(200);

    for (const s of [local, session]) {
      expect(s.setItem).not.toHaveBeenCalled();
      expect(s.getItem).not.toHaveBeenCalled();
    }
    expect(idb.open).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(h.fsWrites).toEqual([]);
  });

  it("success, AI failure, and validation paths write no user text to console, stdout, or stderr", async () => {
    fetchMock.mockResolvedValueOnce(aiResponse(AI_HIGH));
    await scan();
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 500 }));
    await scan();
    await route.POST(post(""));
    // Assertions run in afterEach (only safe diagnostic lines; no stdout/stderr write contains MARKER).
    expect(h.events.filter((e) => e === "ai:start")).toHaveLength(2);
    // One diagnostic per AI call: success (info), HTTP 500 (warn). Validation failures never reach the AI.
    const [, info, warn] = consoleSpies;
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      '[scryvorn:ai] attempted=true status=200 category=none message="AI interpretation succeeded."',
    ]);
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      '[scryvorn:ai] attempted=true status=500 category=unexpected_response message="The provider returned HTTP 500."',
    ]);
  });
});
