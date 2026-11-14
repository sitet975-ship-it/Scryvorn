// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_TIMEOUT_MS } from "@/lib/constants";
import { chatCompletionsEndpoint, runAiInterpretation } from "./aiInterpretation";
import { buildAiPrompt } from "./prompt";

// Synthetic, non-functional test values only.
const KEY = "sk-test-NOT-A-REAL-KEY-7f3a";
const BASE = "https://api.example.test/v1/";
const ENDPOINT = "https://api.example.test/v1/chat/completions";
const MODEL = "test-model";
const INPUT = "Synthetic message: send your OTP 4321 now";
const SUMMARY = "scam_triggers: credential_request";

const TIMEOUT = { unavailable: true, reason: "timeout" };
const ERROR = { unavailable: true, reason: "error" };

const fetchMock = vi.fn();

function envelope(content: unknown): Response {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return new Response(
    JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: text } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const VALID = {
  findings: [
    {
      category: "credential_request",
      label: "Asks for a one-time passcode",
      evidence: 'Quotes "send your OTP 4321 now".',
      severity: "high",
    },
    {
      category: "urgency_pressure",
      label: "Time pressure",
      evidence: 'Uses "now".',
      severity: "low",
    },
  ],
  recommendedSteps: ["Do not share the code.", "Contact the organization through its official app."],
};

/** A fetch that never resolves until its signal aborts. */
function hangingFetch(_url: string, init?: RequestInit) {
  return new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });
}

beforeEach(() => {
  vi.stubEnv("AI_API_KEY", KEY);
  vi.stubEnv("AI_API_BASE_URL", BASE);
  vi.stubEnv("AI_MODEL", MODEL);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("successful interpretation", () => {
  it("returns validated findings with severity-mapped weights and steps", async () => {
    fetchMock.mockResolvedValueOnce(envelope(VALID));
    const out = await runAiInterpretation(INPUT, SUMMARY);

    expect(out).toEqual({
      unavailable: false,
      findings: [
        {
          id: "ai:0",
          source: "ai",
          category: "credential_request",
          label: "Asks for a one-time passcode",
          evidence: 'Quotes "send your OTP 4321 now".',
          severity: "high",
          weight: 25,
        },
        {
          id: "ai:1",
          source: "ai",
          category: "urgency_pressure",
          label: "Time pressure",
          evidence: 'Uses "now".',
          severity: "low",
          weight: 8,
        },
      ],
      recommendedSteps: VALID.recommendedSteps,
    });
  });

  it("sends one POST to the combined endpoint with the built prompt", async () => {
    fetchMock.mockResolvedValueOnce(envelope(VALID));
    await runAiInterpretation(INPUT, SUMMARY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(MODEL);
    expect(body.messages).toEqual([{ role: "user", content: buildAiPrompt(INPUT, SUMMARY) }]);
  });

  it("accepts a valid empty result", async () => {
    fetchMock.mockResolvedValueOnce(envelope({ findings: [], recommendedSteps: [] }));
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual({
      unavailable: false,
      findings: [],
      recommendedSteps: [],
    });
  });
});

describe("configuration", () => {
  it.each(["AI_API_KEY", "AI_API_BASE_URL", "AI_MODEL"])(
    "returns error without a request when %s is missing or blank",
    async (name) => {
      for (const value of ["", "   "]) {
        vi.stubEnv(name, value);
        expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("returns error without a request for an unusable base URL", async () => {
    for (const base of [
      "not a url",
      "http://api.example.test/v1",
      "ftp://api.example.test/v1",
      "https://api.example.test/v1?x=1",
      "https://user:pass@api.example.test/v1",
    ]) {
      vi.stubEnv("AI_API_BASE_URL", base);
      expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("combines base URL and path as documented", () => {
    expect(chatCompletionsEndpoint("https://api.example.test/v1")).toBe(ENDPOINT);
    expect(chatCompletionsEndpoint("https://api.example.test/v1///")).toBe(ENDPOINT);
    expect(chatCompletionsEndpoint("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    expect(chatCompletionsEndpoint("http://127.0.0.1:8080/v1")).toBe(
      "http://127.0.0.1:8080/v1/chat/completions",
    );
    expect(chatCompletionsEndpoint("http://example.test/v1")).toBeNull();
  });

  it("returns error without a request when called where window exists", async () => {
    vi.stubGlobal("window", {});
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns error without a request for timeoutMs %s",
    async (timeoutMs) => {
      expect(await runAiInterpretation(INPUT, SUMMARY, { timeoutMs })).toEqual(ERROR);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("transport and envelope failures", () => {
  it.each([400, 401, 429, 500, 503])("returns error for HTTP %s", async (status) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: `provider detail ${KEY}` } }), { status }),
    );
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
  });

  it("returns error for a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
  });

  it.each([
    ["non-JSON body", "<html>gateway</html>"],
    ["empty object", "{}"],
    ["choices not an array", JSON.stringify({ choices: {} })],
    ["empty choices", JSON.stringify({ choices: [] })],
    ["missing message", JSON.stringify({ choices: [{}] })],
    ["null content", JSON.stringify({ choices: [{ message: { content: null } }] })],
    ["numeric content", JSON.stringify({ choices: [{ message: { content: 42 } }] })],
  ])("returns error for an invalid envelope (%s)", async (_name, body) => {
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
  });
});

describe("content validation", () => {
  const finding = VALID.findings[0];

  it.each([
    ["not JSON", "I think this is a scam."],
    ["fenced JSON", "```json\n" + JSON.stringify(VALID) + "\n```"],
    ["JSON array", "[]"],
    ["JSON null", "null"],
  ])("returns error for malformed content (%s)", async (_name, content) => {
    fetchMock.mockResolvedValueOnce(envelope(content));
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
  });

  it.each([
    ["missing findings", { recommendedSteps: [] }],
    ["missing recommendedSteps", { findings: [] }],
    ["extra top-level key", { findings: [], recommendedSteps: [], verdict: "safe" }],
    ["findings not an array", { findings: {}, recommendedSteps: [] }],
    ["finding not an object", { findings: ["scam"], recommendedSteps: [] }],
    ["finding missing evidence", { findings: [{ ...finding, evidence: undefined }], recommendedSteps: [] }],
    ["finding extra key", { findings: [{ ...finding, url: "x" }], recommendedSteps: [] }],
    ["blank label", { findings: [{ ...finding, label: "  " }], recommendedSteps: [] }],
    ["numeric category", { findings: [{ ...finding, category: 7 }], recommendedSteps: [] }],
    ["unknown severity", { findings: [{ ...finding, severity: "critical" }], recommendedSteps: [] }],
    ["wrong-case severity", { findings: [{ ...finding, severity: "High" }], recommendedSteps: [] }],
    ["numeric severity", { findings: [{ ...finding, severity: 3 }], recommendedSteps: [] }],
    ["steps not an array", { findings: [], recommendedSteps: "Call the bank" }],
    ["non-string step", { findings: [], recommendedSteps: ["ok", 5] }],
    ["blank step", { findings: [], recommendedSteps: [" "] }],
  ])("returns error and does not coerce (%s)", async (_name, content) => {
    fetchMock.mockResolvedValueOnce(envelope(content));
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
  });

  it("rejects the whole result when one finding is invalid", async () => {
    fetchMock.mockResolvedValueOnce(
      envelope({
        findings: [finding, { ...finding, severity: "extreme" }],
        recommendedSteps: [],
      }),
    );
    expect(await runAiInterpretation(INPUT, SUMMARY)).toEqual(ERROR);
  });
});

describe("timeout", () => {
  it("times out during the request, aborts it, and clears the timer", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);
    const p = runAiInterpretation(INPUT, SUMMARY, { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual(TIMEOUT);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out even if fetch ignores the abort signal", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const p = runAiInterpretation(INPUT, SUMMARY, { timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toEqual(TIMEOUT);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out while reading the response body", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce(async (_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return { ok: true, status: 200, text: () => new Promise<string>(() => {}) };
    });
    const p = runAiInterpretation(INPUT, SUMMARY, { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual(TIMEOUT);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses AI_TIMEOUT_MS (30,000 ms) by default", async () => {
    expect(AI_TIMEOUT_MS).toBe(30_000);
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);
    let settled = false;
    const p = runAiInterpretation(INPUT, SUMMARY).then((o) => {
      settled = true;
      return o;
    });

    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual(TIMEOUT);
  });

  it("honors a numeric override", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hangingFetch);
    let settled = false;
    const p = runAiInterpretation(INPUT, SUMMARY, { timeoutMs: 2000 }).then((o) => {
      settled = true;
      return o;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual(TIMEOUT);
  });

  it("clears the timer after success, HTTP error, network error, and invalid content", async () => {
    vi.useFakeTimers();
    const responses: Array<() => Promise<Response>> = [
      async () => envelope(VALID),
      async () => new Response("{}", { status: 500 }),
      async () => {
        throw new TypeError("fetch failed");
      },
      async () => envelope("not json"),
    ];
    for (const make of responses) {
      fetchMock.mockImplementationOnce(make);
      await runAiInterpretation(INPUT, SUMMARY, { timeoutMs: 1000 });
      expect(vi.getTimerCount()).toBe(0);
    }
  });
});

describe("no leakage", () => {
  it("returns only the stable outcome, with no credentials, input, or provider text", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const failures: Array<() => Promise<Response>> = [
      async () => {
        throw new Error(`network down ${KEY} ${INPUT}`);
      },
      async () =>
        new Response(JSON.stringify({ error: `bad key ${KEY} for ${INPUT}` }), { status: 401 }),
      async () => envelope(`not json ${KEY} ${INPUT}`),
    ];

    for (const make of failures) {
      fetchMock.mockImplementationOnce(make);
      const out = await runAiInterpretation(INPUT, SUMMARY);
      expect(out).toEqual(ERROR);
      expect(Object.keys(out).sort()).toEqual(["reason", "unavailable"]);
      const serialized = JSON.stringify(out);
      expect(serialized).not.toContain(KEY);
      expect(serialized).not.toContain("4321");
      expect(serialized).not.toContain("network down");
    }
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it("returns the same outcome shape for repeated failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const a = await runAiInterpretation(INPUT, SUMMARY);
    const b = await runAiInterpretation("other input", "other summary");
    expect(a).toEqual(ERROR);
    expect(b).toEqual(a);
  });
});
