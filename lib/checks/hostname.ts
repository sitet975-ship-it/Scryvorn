/**
 * Shared hostname helpers for deterministic URL checks.
 *
 * NOTE: No Public Suffix List is used. Matching is exact-hostname-or-subdomain
 * against list entries, which is a conservative stand-in for a
 * "registrable domain" match.
 */

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Parses a URL with the WHATWG URL parser (syntax only, never resolved).
 * Links written without a scheme ("www.x.com", "x.com/login") are parsed as
 * http:// for inspection only. Returns null if unparseable. Never throws.
 */
export function parseUrl(url: string): URL | null {
  if (typeof url !== "string" || url.trim() === "") return null;
  try {
    return new URL(HAS_SCHEME.test(url) ? url : `http://${url}`);
  } catch {
    return null;
  }
}

/**
 * Parses a URL and returns its lowercase hostname with a single trailing dot
 * removed. Scheme-less links ("www.x.com") are accepted (see parseUrl).
 * Returns null if the URL is unparseable or the hostname is empty.
 * Never throws.
 */
export function parseHostname(url: string): string | null {
  try {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    let host = parsed.hostname.toLowerCase();
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
