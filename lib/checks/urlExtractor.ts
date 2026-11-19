import urlRiskSignals from "@/data/urlRiskSignals.json";

/**
 * URL extractor (pure, deterministic).
 *
 * Performs no network, DNS, or fetch activity: URLs are only parsed
 * syntactically with the WHATWG `URL` constructor, never resolved or crawled.
 */

/** Matches http(s):// URLs and bare `www.` hosts up to whitespace or <>" chars. */
const CANDIDATE_RE = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;

/**
 * Bare links written without http:// or www. ("paypa1-login.com/verify").
 * The match must not start inside a word, an email address ("@"), or another
 * URL, and its top-level domain must be on the reviewed `bareDomainTlds`
 * list (data/urlRiskSignals.json), so "Node.js" or "e.g." are not links.
 */
const BARE_RE =
  /(?<![\p{L}\p{N}@._\/:-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24})(?::\d{2,5})?(?:\/[^\s<>"]*)?(?![\p{L}\p{N}_-])/giu;
const BARE_TLDS = new Set(urlRiskSignals.bareDomainTlds.map((t) => t.toLowerCase()));

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
 * Extract every http(s) URL, bare `www.` host, and bare "name.tld" link
 * (reviewed TLDs only) from `text`.
 *
 * - Returns each URL in its ORIGINAL form as written (after trailing
 *   punctuation is stripped); scheme-less links are NOT rewritten with a scheme.
 * - Unparseable tokens and tokens without a hostname are skipped; never throws.
 * - Duplicates (exact string match) are removed, preserving first-seen order,
 *   so identical input always yields identical output.
 * - Empty or whitespace-only input returns [].
 */
export function extractUrls(text: string): string[] {
  if (typeof text !== "string" || text.trim() === "") return [];

  const seen = new Set<string>();
  const result: string[] = [];

  const candidates: { index: number; end: number; value: string }[] = [];
  for (const m of text.matchAll(CANDIDATE_RE)) {
    candidates.push({ index: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0] });
  }
  const explicit = candidates.slice();
  for (const m of text.matchAll(BARE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!BARE_TLDS.has(m[1].toLowerCase())) continue;
    if (explicit.some((c) => start < c.end && end > c.index)) continue;
    candidates.push({ index: start, end, value: m[0] });
  }
  candidates.sort((a, b) => a.index - b.index);

  for (const match of candidates) {
    const candidate = stripTrailing(match.value);
    if (!candidate || seen.has(candidate)) continue;
    if (!isValidUrl(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }

  return result;
}
