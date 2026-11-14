/**
 * Shared hostname helpers for deterministic URL checks.
 *
 * NOTE: No Public Suffix List is used. Matching is exact-hostname-or-subdomain
 * against list entries, which is a conservative stand-in for a
 * "registrable domain" match.
 */

/**
 * Parses a URL and returns its lowercase hostname with a single trailing dot
 * removed. Returns null if the URL is unparseable or the hostname is empty.
 * Never throws.
 */
export function parseHostname(url: string): string | null {
  try {
    let host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".")) host = host.slice(0, -1);
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

/**
 * True iff `hostname` equals `domain` or is a subdomain of it
 * (hostname ends with "." + domain). Both sides are compared lowercase.
 * `bit.ly` and `x.bit.ly` match `bit.ly`; `notbit.ly` and `bit.ly.evil.com` do not.
 */
export function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase();
  const d = domain.toLowerCase();
  if (!h || !d) return false;
  return h === d || h.endsWith("." + d);
}
