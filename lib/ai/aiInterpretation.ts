import { AI_TIMEOUT_MS, SCORING_WEIGHTS } from "@/lib/constants";
import { categorizeStatus, logAiDiagnostic, safeNetworkCode, safeProviderCode } from "./diagnostics";
import { AI_SEVERITY_VALUES, buildAiPrompt } from "./prompt";
import type { AiFinding, AiOutcome } from "./types";

/**
 * AI interpretation engine (server-side only).
 *
 * Server-side by convention: only the scan API route may import this module.
 * It reads AI_API_KEY, AI_API_BASE_URL, and AI_MODEL from `process.env` at
 * call time. They are not NEXT_PUBLIC_ variables, so Next.js never inlines
 * them into client bundles. As a further guard it returns an error outcome,
 * without reading the environment, if it is ever called where `window` exists.
 *
 * Endpoint: AI_API_BASE_URL with trailing slashes removed, then
 * "/chat/completions" appended. The base URL should therefore include the API
 * version path (e.g. "https://api.example.com/v1" ->
 * "https://api.example.com/v1/chat/completions"). It must be https, or http
 * only for localhost / 127.0.0.1 / [::1]; otherwise the configuration is
 * treated as missing.
 *
 * Timeout: one timer covers both the request and reading the response body.
 * When it fires the request is aborted and the outcome is
 * { unavailable: true, reason: "timeout" }. The timer is cleared on every
 * exit path.
 *
 * Failures (missing configuration, network error, non-2xx status, malformed
 * envelope, non-JSON content, or content that does not match the exact
 * expected shape) all return { unavailable: true, reason: "error" }. Outcomes
 * never contain credentials, provider error text, or submitted content.
 * Malformed findings are rejected, never coerced.
 *
 * Diagnostics: each call writes one safe server log line via
 * ./diagnostics (attempted, HTTP status, category, fixed message, and at
 * most a short provider error code). The key, headers, request body,
 * submitted message, model output, and raw provider responses are never
 * logged.
 *
 * Does not compute the Risk_Score. `weight` is filled from the existing
 * SCORING_WEIGHTS.ai table for the finding's severity.
 */

const TIMEOUT: AiOutcome = Object.freeze({ unavailable: true, reason: "timeout" });
const ERROR: AiOutcome = Object.freeze({ unavailable: true, reason: "error" });

const ENDPOINT_PATH = "/chat/completions";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const FINDING_KEYS = ["category", "evidence", "label", "severity"];
const TOP_LEVEL_KEYS = ["findings", "recommendedSteps"];

interface AiConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

/** Builds the endpoint from a base URL, or returns null if it is unusable. */
export function chatCompletionsEndpoint(baseUrl: string): string | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed + ENDPOINT_PATH);
  } catch {
    return null;
  }
  if (url.search || url.hash || url.username || url.password) return null;
  if (url.protocol === "https:") return url.toString();
  if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return url.toString();
  return null;
}

/**
 * Reads the configuration, or lists the problems by variable name only
 * (values are never included).
 */
function readConfig(): { config: AiConfig } | { problems: string[] } {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const apiKey = env?.AI_API_KEY?.trim();
  const baseUrl = env?.AI_API_BASE_URL?.trim();
  const model = env?.AI_MODEL?.trim();
  const problems: string[] = [];
  if (!apiKey) problems.push("AI_API_KEY is missing");
  if (!baseUrl) problems.push("AI_API_BASE_URL is missing");
  if (!model) problems.push("AI_MODEL is missing");
  const endpoint = baseUrl ? chatCompletionsEndpoint(baseUrl) : null;
  if (baseUrl && !endpoint) problems.push("AI_API_BASE_URL is not a usable https URL");
  if (problems.length > 0 || !apiKey || !model || !endpoint) return { problems };
  return { config: { apiKey, endpoint, model } };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasExactKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(obj).sort();
  return actual.length === keys.length && actual.every((k, i) => k === keys[i]);
}

function isNonBlankString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function isSeverity(v: unknown): v is AiFinding["severity"] {
  return (AI_SEVERITY_VALUES as readonly unknown[]).includes(v);
}

/** Extracts choices[0].message.content from a Chat Completions envelope. */
function extractContent(envelope: unknown): string | null {
  if (!isPlainObject(envelope) || !Array.isArray(envelope.choices)) return null;
  const first = envelope.choices[0];
  if (!isPlainObject(first) || !isPlainObject(first.message)) return null;
  const content = first.message.content;
  return typeof content === "string" ? content : null;
}

/**
 * Validates the model's JSON against the exact expected shape. Returns null
 * for anything else: extra or missing keys, non-string or blank fields,
 * severities outside "low" | "medium" | "high", or non-string steps.
 */
export function parseAiContent(
  content: string,
): { findings: AiFinding[]; recommendedSteps: string[] } | null {
  const r = validateAiContent(content);
  return "rejected" in r ? null : r;
}

/**
 * Same validation as parseAiContent, but on rejection returns a fixed,
 * content-free reason for the server diagnostics.
 */
function validateAiContent(
  content: string,
): { findings: AiFinding[]; recommendedSteps: string[] } | { rejected: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      rejected: content.trim().startsWith("```")
        ? "Model content is not valid JSON: it is wrapped in a markdown code fence."
        : "Model content is not valid JSON.",
    };
  }
  if (!isPlainObject(parsed) || !hasExactKeys(parsed, TOP_LEVEL_KEYS)) {
    return { rejected: "Model JSON is not an object with exactly the keys findings and recommendedSteps." };
  }

  const { findings: rawFindings, recommendedSteps: rawSteps } = parsed;
  if (!Array.isArray(rawFindings) || !Array.isArray(rawSteps)) {
    return { rejected: "Model JSON findings or recommendedSteps is not an array." };
  }
  if (!rawSteps.every(isNonBlankString)) {
    return { rejected: "Model JSON recommendedSteps has a blank or non-string item." };
  }

  const findings: AiFinding[] = [];
  for (const [i, raw] of rawFindings.entries()) {
    if (!isPlainObject(raw) || !hasExactKeys(raw, FINDING_KEYS)) {
      return { rejected: `Model finding ${i} does not have exactly the keys category, label, evidence, severity.` };
    }
    const { category, label, evidence, severity } = raw;
    if (
      !isNonBlankString(category) ||
      !isNonBlankString(label) ||
      !isNonBlankString(evidence) ||
      !isSeverity(severity)
    ) {
      return {
        rejected: `Model finding ${i} has a blank or non-string field, or a severity other than low, medium, or high.`,
      };
    }
    findings.push({
      id: `ai:${i}`,
      source: "ai",
      category,
      label,
      evidence,
      severity,
      weight: SCORING_WEIGHTS.ai[severity],
    });
  }
  return { findings, recommendedSteps: [...rawSteps] };
}

class TimeoutSignal {}

/**
 * From a non-2xx response, returns only the provider's error.code (or
 * error.type) if it is a short lowercase token. The rest of the body is
 * discarded. Never throws.
 */
async function readProviderCode(response: Response, timedOut: Promise<never>): Promise<string | undefined> {
  try {
    const body: unknown = JSON.parse(await Promise.race([response.text(), timedOut]));
    if (!isPlainObject(body) || !isPlainObject(body.error)) return undefined;
    return safeProviderCode(body.error.code) ?? safeProviderCode(body.error.type);
  } catch {
    return undefined;
  }
}

export async function runAiInterpretation(
  input: string,
  deterministicSummary: string,
  opts?: { timeoutMs?: number },
): Promise<AiOutcome> {
  if (typeof window !== "undefined") return ERROR;

  const timeoutMs = opts?.timeoutMs ?? AI_TIMEOUT_MS;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    logAiDiagnostic({ attempted: false, status: null, category: "not_configured", message: "Invalid AI timeout setting." });
    return ERROR;
  }

  const read = readConfig();
  if ("problems" in read) {
    logAiDiagnostic({ attempted: false, status: null, category: "not_configured", message: read.problems.join("; ") + "." });
    return ERROR;
  }
  const { config } = read;
  /** Logs a 2xx response that could not be used. */
  const unusable = (status: number, message: string): AiOutcome => {
    logAiDiagnostic({ attempted: true, status, category: "unexpected_response", message });
    return ERROR;
  };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutSignal());
    }, timeoutMs);
  });
  // Prevent an unhandled rejection if the timer fires after another exit.
  timedOut.catch(() => {});

  try {
    const response = await Promise.race([
      fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          messages: [{ role: "user", content: buildAiPrompt(input, deterministicSummary) }],
        }),
        signal: controller.signal,
      }),
      timedOut,
    ]);

    if (!response.ok) {
      logAiDiagnostic({
        attempted: true,
        status: response.status,
        ...categorizeStatus(response.status),
        providerCode: await readProviderCode(response, timedOut),
      });
      return ERROR;
    }

    const text = await Promise.race([response.text(), timedOut]);

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return unusable(response.status, "Response body is not JSON.");
    }
    const content = extractContent(envelope);
    if (content === null) return unusable(response.status, "Response has no choices[0].message.content string.");

    const result = validateAiContent(content);
    if ("rejected" in result) return unusable(response.status, result.rejected);
    logAiDiagnostic({ attempted: true, status: response.status, category: "none", message: "AI interpretation succeeded." });
    return { unavailable: false, ...result };
  } catch (err) {
    // Never expose provider or network error details in the outcome.
    const timedOutNow = err instanceof TimeoutSignal || controller.signal.aborted;
    const code = timedOutNow ? undefined : safeNetworkCode(err);
    logAiDiagnostic({
      attempted: true,
      status: null,
      category: "network_error",
      message: timedOutNow
        ? `Request timed out after ${timeoutMs} ms.`
        : `Request failed before a response was received${code ? ` (${code})` : ""}.`,
    });
    return timedOutNow ? TIMEOUT : ERROR;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
