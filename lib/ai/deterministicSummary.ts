import {
  DETERMINISTIC_SUMMARY_MAX_FINDINGS,
  DETERMINISTIC_SUMMARY_MAX_LINE_CHARS,
  DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS,
} from "@/lib/constants";
import { parseHostname } from "@/lib/checks/hostname";
import type { DeterministicFinding, DeterministicResult } from "@/lib/checks/types";
import { extractUrls } from "@/lib/checks/urlExtractor";

/**
 * Builds the deterministic summary passed to `buildAiPrompt` (pure; no network,
 * no environment access).
 *
 * Format, in a fixed order:
 *  1. A status line: `status: complete`, or
 *     `status: incomplete; unfinished: <check>, <check>`.
 *  2. One line per finding, in engine order:
 *     `- <category> | <label>` plus ` | host: <hostname>` for URL-based
 *     findings or ` | matched: <text>` for scam-trigger findings.
 *  3. If any finding is left out by a cap: `- (N more findings omitted)`.
 *
 * Never included: weights, scores, severity tiers, wax-seal colors, exception
 * text, or any request field other than what the engine derived from `input`.
 * URL-like text inside labels or matched text is replaced with its hostname
 * (or `[url]`), so no raw URL appears.
 *
 * Caps (lib/constants.ts), measured in string length (UTF-16 code units):
 * each line is cut to DETERMINISTIC_SUMMARY_MAX_LINE_CHARS (ending in "…"); at
 * most DETERMINISTIC_SUMMARY_MAX_FINDINGS finding lines; a finding line is
 * added only if the summary, plus room for an omission line, stays within
 * DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS.
 *
 * The output is user-derived and untrusted. Callers must treat it as data and
 * must not log it.
 */

const ELLIPSIS = "…";
const CONTROL_AND_SPACE = /[\s\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]+/g;
const BARE_HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** Cuts `line` to `max` code units, ending in "…", without splitting a surrogate pair. */
function capLine(line: string, max: number): string {
  if (line.length <= max) return line;
  let cut = line.slice(0, max - ELLIPSIS.length);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut + ELLIPSIS;
}

function hostnameOf(url: string): string | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`;
  return parseHostname(withScheme);
}

/** One line of plain text with URL-like substrings replaced by hostnames. */
function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  let text = value.replace(CONTROL_AND_SPACE, " ").trim();
  const urls = extractUrls(text).sort((a, b) => b.length - a.length);
  for (const url of urls) {
    text = text.split(url).join(hostnameOf(url) ?? "[url]");
  }
  return text;
}

function findingHost(f: DeterministicFinding): string | null {
  if (!f.url) return null;
  const host = hostnameOf(f.url);
  if (host) return host;
  const bare = f.url.trim().toLowerCase();
  return BARE_HOSTNAME.test(bare) ? bare : null;
}

function findingLine(f: DeterministicFinding): string {
  let line = `- ${clean(f.category)} | ${clean(f.label)}`;
  const host = findingHost(f);
  if (host) line += ` | host: ${clean(host)}`;
  else if (f.matchedText) line += ` | matched: ${clean(f.matchedText)}`;
  return capLine(line, DETERMINISTIC_SUMMARY_MAX_LINE_CHARS);
}

function statusLine(det: DeterministicResult): string {
  const unfinished = det.incompleteChecks.map(clean).filter(Boolean);
  const line =
    det.status === "complete" && unfinished.length === 0
      ? "status: complete"
      : `status: incomplete; unfinished: ${unfinished.length ? unfinished.join(", ") : "unknown"}`;
  return capLine(line, DETERMINISTIC_SUMMARY_MAX_LINE_CHARS);
}

const omissionLine = (n: number) => `- (${n} more findings omitted)`;

export function buildDeterministicSummary(det: DeterministicResult): string {
  const lines = [statusLine(det)];
  let length = lines[0].length;
  const total = det.findings.length;
  let included = 0;

  for (const f of det.findings.slice(0, DETERMINISTIC_SUMMARY_MAX_FINDINGS)) {
    const line = findingLine(f);
    const remainingAfter = total - (included + 1);
    const reserve = remainingAfter > 0 ? 1 + omissionLine(remainingAfter).length : 0;
    if (length + 1 + line.length + reserve > DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS) break;
    lines.push(line);
    length += 1 + line.length;
    included++;
  }

  const omitted = total - included;
  if (omitted > 0) lines.push(omissionLine(omitted));
  return lines.join("\n");
}
