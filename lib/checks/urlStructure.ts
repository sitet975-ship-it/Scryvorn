import { SCORING_WEIGHTS } from "@/lib/constants";
import { parseUrl } from "./hostname";
import type { DeterministicFinding, UrlRiskSignals } from "./types";

/**
 * Link-structure rules for a single URL (pure, deterministic, no network,
 * no DNS, never visits the link). Only the parsed address is inspected.
 *
 * These rules work on links Scryvorn has never seen before: they look at how
 * the address is built, not at a list of known bad sites. Each finding quotes
 * the part of the address that triggered it and names the rule. A finding
 * says a pattern "often appears in phishing links"; it never says the link
 * is fraudulent, and no finding means nothing about safety.
 *
 * Rules (weights in SCORING_WEIGHTS.deterministic):
 *  - ip_address_host: the host is a raw IP address.
 *  - credentials_in_url: text before "@" in the address (the browser ignores
 *    it and goes to the host after "@").
 *  - punycode_host: an "xn--" label (internationalized characters that can
 *    imitate familiar letters).
 *  - deceptive_domain_structure: a domain ending such as "com" placed before
 *    the real domain ("paypal.com.example-login.xyz"), or six or more labels.
 *  - digit_letter_swap: a word in the host with "0" or "1" between letters
 *    ("amaz0n", "g00gle").
 *  - sensitive_host_keywords: whole words such as "login" or "verify" in the
 *    host (heavier with three or more distinct words).
 *  - sensitive_path_keywords: whole words such as "verify" or "password" in
 *    the path or query.
 *  - many_hyphens: three or more hyphens in the host.
 *  - nonstandard_port: an explicit, non-default port.
 *
 * Returns [] for an unparseable URL. Unexpected internal errors propagate so
 * the deterministic engine can mark the run incomplete.
 */

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const WORD_SPLIT = /[^a-z0-9]+/;
/** A word with 0 or 1 strictly between letters, and at least four letters. */
const DIGIT_SWAP = /^(?=(?:.*[a-z]){4})[a-z]+(?:[01]+[a-z]+)+$/;

const W = SCORING_WEIGHTS.deterministic;

function words(s: string): string[] {
  return s.toLowerCase().split(WORD_SPLIT).filter(Boolean);
}

function uniqueMatches(tokens: string[], keywords: readonly string[]): string[] {
  const set = new Set(keywords.map((k) => k.toLowerCase()));
  const out: string[] = [];
  for (const t of tokens) if (set.has(t) && !out.includes(t)) out.push(t);
  return out;
}

const quoteList = (items: string[]) => items.map((i) => `"${i}"`).join(", ");

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function checkUrlStructure(url: string, signals: UrlRiskSignals): DeterministicFinding[] {
  const parsed = parseUrl(url);
  if (!parsed) return [];
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (!host) return [];

  const reference = `urlRiskSignals.json v${signals.version} (${signals.source}, ${signals.date})`;
  const findings: DeterministicFinding[] = [];
  const add = (
    category: string,
    label: string,
    evidence: string,
    severity: DeterministicFinding["severity"],
    weight: number,
  ) =>
    findings.push({
      id: `url_structure:${category}:${url}`,
      source: "deterministic",
      check: "url_structure",
      category,
      label,
      evidence,
      url,
      reference,
      severity,
      weight,
    });

  const isIp = IPV4.test(host) || host.startsWith("[");

  if (isIp) {
    add(
      "ip_address_host",
      "Link uses a raw IP address",
      `The link goes to the IP address "${host}" instead of a named website. Organizations rarely send links like this; this pattern often appears in phishing links.`,
      "medium",
      W.url_ip_address_host,
    );
  }

  if (parsed.username || parsed.password) {
    add(
      "credentials_in_url",
      "Hidden destination after \"@\"",
      `The address contains "${safeDecode(parsed.username || parsed.password)}" before an "@". Browsers ignore that part and open "${host}", so the link may not go where it appears to.`,
      "medium",
      W.url_credentials_in_url,
    );
  }

  if (!isIp) hostNameRules(host, signals, add);

  const pathHits = uniqueMatches(words(`${parsed.pathname} ${parsed.search}`), signals.pathKeywords);
  if (pathHits.length > 0) {
    add(
      "sensitive_path_keywords",
      "Sensitive words in the link path",
      `The link path contains ${quoteList(pathHits)}. Phishing links often lead to pages that ask you to sign in, verify, or pay.`,
      "low",
      W.url_sensitive_path_keywords,
    );
  }

  if (parsed.port) {
    add(
      "nonstandard_port",
      "Unusual port number",
      `The link uses port ${parsed.port} ("${host}:${parsed.port}"). Ordinary websites rarely specify a port in links they send.`,
      "low",
      W.url_nonstandard_port,
    );
  }

  return findings;
}

type AddFn = (
  category: string,
  label: string,
  evidence: string,
  severity: DeterministicFinding["severity"],
  weight: number,
) => void;

/** Rules that inspect a named (non-IP) hostname; each match is passed to `add`. */
function hostNameRules(host: string, signals: UrlRiskSignals, add: AddFn): void {
  const labels = host.split(".");
  const last = labels[labels.length - 1];

  if (labels.some((l) => l.startsWith("xn--"))) {
    add(
      "punycode_host",
      "Internationalized (punycode) web address",
      `The hostname "${host}" contains an "xn--" label, which encodes special characters. These can imitate familiar letters, so the name may not be what it looks like.`,
      "medium",
      W.url_punycode_host,
    );
  }

  const embedded = new Set(signals.embeddedTldLabels.map((t) => t.toLowerCase()));
  const embeddedAt = labels.findIndex((l, i) => {
    if (!embedded.has(l)) return false;
    if (i < labels.length - 2) return true;
    // "example.com.au" style endings: allowed before a two-letter country code.
    return i === labels.length - 2 && last.length !== 2;
  });
  if (embeddedAt !== -1) {
    const realDomain = labels.slice(-2).join(".");
    add(
      "deceptive_domain_structure",
      "Misleading domain structure",
      `The hostname "${host}" contains ".${labels[embeddedAt]}" before its real ending, so it can look like "${labels
        .slice(0, embeddedAt + 1)
        .join(".")}" while the link actually belongs to "${realDomain}".`,
      "medium",
      W.url_deceptive_domain_structure,
    );
  } else if (labels.length >= 6) {
    add(
      "deceptive_domain_structure",
      "Misleading domain structure",
      `The hostname "${host}" has ${labels.length} levels. Long chains of subdomains can hide the real domain at the end of the address.`,
      "medium",
      W.url_deceptive_domain_structure,
    );
  }

  const hostWords = words(labels.slice(0, -1).join("."));
  const swapped = hostWords.filter((w) => !w.startsWith("xn") && DIGIT_SWAP.test(w));
  if (swapped.length > 0) {
    add(
      "digit_letter_swap",
      "Digits standing in for letters",
      `The hostname "${host}" contains ${quoteList(swapped)}, where "0" or "1" sits between letters. Swapping letters for look-alike digits is a common way to imitate familiar names.`,
      "medium",
      W.url_digit_letter_swap,
    );
  }

  const hostHits = uniqueMatches(hostWords, signals.hostKeywords);
  if (hostHits.length > 0) {
    const many = hostHits.length >= 3;
    add(
      "sensitive_host_keywords",
      "Sensitive words in the web address",
      `The hostname "${host}" contains ${quoteList(hostHits)}. Words like these are often added to addresses to make a link look official.`,
      many ? "medium" : "low",
      many ? W.url_sensitive_host_keywords_many : W.url_sensitive_host_keywords,
    );
  }

  const hyphens = (host.replace(/xn--/g, "").match(/-/g) ?? []).length;
  if (hyphens >= 3) {
    add(
      "many_hyphens",
      "Many hyphens in the web address",
      `The hostname "${host}" contains ${hyphens} hyphens. Long hyphenated names are often used to string official-sounding words together.`,
      "low",
      W.url_many_hyphens,
    );
  }
}
