import { SCORING_WEIGHTS } from "@/lib/constants";
import { hostnameMatchesDomain, parseHostname } from "./hostname";
import type { DeterministicFinding, ShortenerList } from "./types";

/**
 * Flags URLs whose hostname is (a subdomain of) a known URL-shortener domain.
 * Only the parsed hostname is matched, never the path or query.
 * Pure: no network access, no redirect resolution.
 *
 * Severity is "low": a shortener hides the destination but is not itself
 * evidence of malice.
 */
export function detectShortener(
  url: string,
  list: ShortenerList,
): DeterministicFinding | null {
  const hostname = parseHostname(url);
  if (!hostname) return null;

  const matched = list.domains.some((d) => hostnameMatchesDomain(hostname, d));
  if (!matched) return null;

  return {
    id: `shortener:${url}`,
    source: "deterministic",
    check: "shortener",
    category: "shortener",
    label: "URL shortener",
    evidence: `The hostname "${hostname}" is a known URL-shortener domain, so the true destination of this link is hidden until it is opened.`,
    url,
    reference: `shorteners.json v${list.version} (${list.source}, ${list.date})`,
    severity: "low",
    weight: SCORING_WEIGHTS.deterministic.shortener,
  };
}
