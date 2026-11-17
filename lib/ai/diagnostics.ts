/**
 * Safe server-side diagnostics for the AI interpretation request.
 *
 * Writes one line per AI interpretation call to the server log (Netlify
 * function logs). A line records only:
 * - whether a request to the provider was attempted,
 * - the HTTP status code (or "none"),
 * - a short category,
 * - a short message chosen by this code (never provider text),
 * - optionally the provider's error code, accepted only if it is a short
 *   lowercase token such as "invalid_api_key" or "model_not_found".
 *
 * It never receives or writes the API key, request headers, the request body,
 * the submitted message, model output, raw provider responses, or stack
 * traces. Logging failures are swallowed so they cannot affect a scan.
 */

export const AI_DIAGNOSTIC_PREFIX = "[scryvorn:ai]";

export type AiDiagnosticCategory =
  | "none"
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "invalid_request"
  | "network_error"
  | "unexpected_response";

export interface AiDiagnostic {
  attempted: boolean;
  status: number | null;
  category: AiDiagnosticCategory;
  message: string;
  providerCode?: string;
}

const PROVIDER_CODE = /^[a-z][a-z0-9_]{0,47}$/;
const NETWORK_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;
const MAX_MESSAGE = 160;

/** Maps a non-2xx HTTP status to a category and a fixed message. */
export function categorizeStatus(status: number): Pick<AiDiagnostic, "category" | "message"> {
  switch (status) {
    case 401:
      return { category: "unauthorized", message: "The provider rejected the API key (check AI_API_KEY)." };
    case 403:
      return { category: "forbidden", message: "The provider refused access for this key or model." };
    case 404:
      return {
        category: "not_found",
        message: "The endpoint or model was not found (check AI_API_BASE_URL and AI_MODEL).",
      };
    case 429:
      return { category: "rate_limited", message: "The provider rate limit or quota was reached." };
    case 400:
    case 422:
      return { category: "invalid_request", message: "The provider rejected the request format or parameters." };
    default:
      return { category: "unexpected_response", message: `The provider returned HTTP ${status}.` };
  }
}

/** Accepts a provider error code only if it is a short lowercase token. */
export function safeProviderCode(value: unknown): string | undefined {
  return typeof value === "string" && PROVIDER_CODE.test(value) ? value : undefined;
}

/** Extracts a short system error code (e.g. ENOTFOUND) from a fetch error, if present. */
export function safeNetworkCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
  const code = cause?.code;
  return typeof code === "string" && NETWORK_CODE.test(code) ? code : undefined;
}

function cleanMessage(message: string): string {
  const flat = message.replace(/["\\\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > MAX_MESSAGE ? flat.slice(0, MAX_MESSAGE - 1) + "…" : flat;
}

/** The exact log line, e.g. `[scryvorn:ai] attempted=true status=401 category=unauthorized message="..."`. */
export function formatAiDiagnostic(d: AiDiagnostic): string {
  const parts = [
    AI_DIAGNOSTIC_PREFIX,
    `attempted=${d.attempted}`,
    `status=${d.status ?? "none"}`,
    `category=${d.category}`,
    `message="${cleanMessage(d.message)}"`,
  ];
  const code = safeProviderCode(d.providerCode);
  if (code) parts.push(`providerCode=${code}`);
  return parts.join(" ");
}

/** Writes the diagnostic line: console.info on success, console.warn otherwise. Never throws. */
export function logAiDiagnostic(d: AiDiagnostic): void {
  try {
    const line = formatAiDiagnostic(d);
    if (d.category === "none") console.info(line);
    else console.warn(line);
  } catch {
    // Diagnostics must never affect a scan.
  }
}
