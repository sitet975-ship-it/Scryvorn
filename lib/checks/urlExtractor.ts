/**
 * URL extractor (pure, deterministic).
 *
 * Performs no network, DNS, or fetch activity: URLs are only parsed
 * syntactically with the WHATWG `URL` constructor, never resolved or crawled.
 */

/** Matches http(s):// URLs and bare `www.` hosts up to whitespace or <>" chars. */
const CANDIDATE_RE = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;

const TRAILING_PUNCTUATION = new Set([".", ",", "!", "?", ";", ":", "'", '"', ")", "]", "}"]);

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/** Strip trailing punctuation that is not part of the URL. Closing brackets are kept when balanced. */
function stripTrailing(candidate: string): string {
  let s = candidate;
  while (s.length > 0) {
    const last = s[s.length - 1];
    if (!TRAILING_PUNCTUATION.has(last)) break;
    if (last === ")" && count(s, ")") <= count(s, "(")) break;
    if (last === "]" && count(s, "]") <= count(s, "[")) break;
    if (last === "}" && count(s, "}") <= count(s, "{")) break;
    s = s.slice(0, -1);
  }
  return s;
}

function isValidUrl(candidate: string): boolean {
  // Bare `www.` hosts are prefixed with http:// for parsing only.
  const toParse = /^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  try {
    const { hostname } = new URL(toParse);
    if (!hostname) return false;
    // "www." with nothing after it is not a usable host.
    if (hostname.toLowerCase() === "www." || hostname.toLowerCase() === "www") return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract every http(s) URL and bare `www.` host from `text`.
 *
 * - Returns each URL in its ORIGINAL form as written (after trailing
 *   punctuation is stripped); `www.` hosts are NOT rewritten with a scheme.
 * - Unparseable tokens and tokens without a hostname are skipped; never throws.
 * - Duplicates (exact string match) are removed, preserving first-seen order,
 *   so identical input always yields identical output.
 * - Empty or whitespace-only input returns [].
 */
export function extractUrls(text: string): string[] {
  if (typeof text !== "string" || text.trim() === "") return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const match of text.matchAll(CANDIDATE_RE)) {
    const candidate = stripTrailing(match[0]);
    if (!candidate || seen.has(candidate)) continue;
    if (!isValidUrl(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }

  return result;
}
