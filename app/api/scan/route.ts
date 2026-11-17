import { buildDeterministicSummary } from "@/lib/ai/deterministicSummary";
import { runAiInterpretation } from "@/lib/ai/aiInterpretation";
import { runDeterministicChecks } from "@/lib/checks/deterministicEngine";
import { extractUrls } from "@/lib/checks/urlExtractor";
import { AI_TIMEOUT_MS, INPUT_MAX_CHARS } from "@/lib/constants";
import { assessScan } from "@/lib/scoring/assessment";
import type { InputType, ScanResult } from "@/lib/types";

/**
 * POST /api/scan: the only server-side surface.
 *
 * Standard Next.js App Router Node.js runtime (no Edge Runtime). Only POST is
 * exported, so other methods get the framework's default 405.
 *
 * Validation order: Content-Type, JSON object body, string `input`
 * (invalid_request); empty after trimming (input_required); longer than
 * INPUT_MAX_CHARS (input_too_long). Only `input` is read; every other request
 * field is ignored, and all findings are generated server-side.
 *
 * Pipeline: deterministic checks (no domain-age service injected), then the
 * deterministic summary, then AI interpretation (also after an incomplete
 * deterministic run), then assessScan. Unexpected failures return a fixed
 * 500 internal_error body. The handler itself logs nothing; the AI client
 * writes one content-free diagnostic line per scan (lib/ai/diagnostics.ts).
 * Every response this handler
 * generates (200, 400, 500) is Cache-Control: no-store; the framework's own
 * 405 and OPTIONS responses do not currently carry that header.
 */

export const runtime = "nodejs";

type ErrorCode = "invalid_request" | "input_required" | "input_too_long" | "internal_error";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const error = (code: ErrorCode, status: number) => json({ error: code }, status);

function isJsonContentType(header: string | null): boolean {
  if (!header) return false;
  return header.split(";")[0].trim().toLowerCase() === "application/json";
}

/** "message" (no URLs), "url" (only URLs and whitespace), or "mixed". */
function inputTypeFor(input: string): InputType {
  const urls = extractUrls(input);
  if (urls.length === 0) return "message";
  let rest = input;
  for (const url of [...urls].sort((a, b) => b.length - a.length)) {
    rest = rest.split(url).join(" ");
  }
  return rest.trim() === "" ? "url" : "mixed";
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return error("invalid_request", 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return error("invalid_request", 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return error("invalid_request", 400);
    }
    const input = (body as Record<string, unknown>).input;
    if (typeof input !== "string") return error("invalid_request", 400);
    if (input.trim() === "") return error("input_required", 400);
    if (input.length > INPUT_MAX_CHARS) return error("input_too_long", 400);

    const det = await runDeterministicChecks(input);
    const deterministicSummary = buildDeterministicSummary(det);
    const ai = await runAiInterpretation(input, deterministicSummary, {
      timeoutMs: AI_TIMEOUT_MS,
    });
    const assessment = assessScan(det, ai);

    const result: ScanResult = {
      timestamp: new Date().toISOString(),
      inputType: inputTypeFor(input),
      ...assessment,
    };
    return json(result, 200);
  } catch {
    // Deliberately no logging and no error details: the body is fixed.
    return error("internal_error", 500);
  }
}
