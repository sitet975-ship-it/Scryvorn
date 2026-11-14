import { SCORING_WEIGHTS } from "@/lib/constants";
import { hostnameMatchesDomain, parseHostname } from "./hostname";
import type {
  DeterministicFinding,
  ElevatedAttentionTldList,
  KnownLegitimateDomainList,
} from "./types";

/**
 * Domain heuristics for a single URL. Pure: no network, no DNS.
 * Only the parsed hostname is inspected, never the path or query.
 *
 * 1. Elevated-attention TLD (informational only, weight 0): the hostname's
 *    final label is on the versioned list. A TLD alone is not evidence of fraud.
 *
 * 2. Lookalike domain: compares the hostname against an INJECTED list of
 *    known-legitimate domains. No production list is bundled or invented.
 *    With an absent or empty list the lookalike check is INACTIVE, meaning it
 *    was NOT performed (this is not the same as "passed").
 *
 *    To supply a reviewed list later, create a reviewed, versioned data file
 *    shaped `{ version, source, date, domains }` (KnownLegitimateDomainList),
 *    import it in the scan route, and pass it through the deterministic
 *    engine opts (`legitimateDomains`) into this function.
 *
 * No Public Suffix List is used. A domain's "base" is its last two labels,
 * an approximation of the registrable domain. Lookalike findings say a domain
 * "resembles" a known domain; they never assert impersonation.
 *
 * NOT READY FOR GENERAL PRODUCTION ACTIVATION: the last-two-labels rule
 * mishandles multi-label public suffixes (e.g. "co.uk"). With "paypal.co.uk"
 * listed, "paypa1.co.uk" is missed; with "paypal.com" listed, the real
 * "paypal.co.uk" gets a misleading low-confidence finding. This must be
 * reviewed and corrected before any production reference list is enabled.
 *
 * Unparseable URLs yield []. Unexpected internal errors are NOT swallowed:
 * they propagate so the deterministic engine can mark the run incomplete
 * instead of returning a normal-looking empty result.
 */

/** True when the injected list can drive lookalike checking. */
export function isLookalikeCheckActive(list?: KnownLegitimateDomainList): boolean {
  return !!list && Array.isArray(list.domains) && list.domains.length > 0;
}

/** Minimum second-level label length for the distance and embedded rules. */
const MIN_LABEL_LENGTH = 4;

/** Single-character confusable pairs (symmetric). */
const CONFUSABLE_CHAR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["0", "o"],
  ["1", "l"],
  ["1", "i"],
  ["l", "i"],
  ["5", "s"],
];

/** Two-character sequences that look like one character: [sequence, single]. */
const CONFUSABLE_SEQUENCES: ReadonlyArray<readonly [string, string]> = [
  ["rn", "m"],
  ["vv", "w"],
];

function isConfusablePair(a: string, b: string): boolean {
  return CONFUSABLE_CHAR_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

/**
 * Describes a single known-confusable edit turning `legit` into `cand`,
 * or null if there is none.
 */
function confusableReason(cand: string, legit: string): string | null {
  if (cand.length === legit.length) {
    let idx = -1;
    for (let i = 0; i < cand.length; i++) {
      if (cand[i] !== legit[i]) {
        if (idx !== -1) {
          idx = -2;
          break;
        }
        idx = i;
      }
    }
    if (idx >= 0 && isConfusablePair(cand[idx], legit[idx])) {
      return `one character substituted: '${cand[idx]}' for '${legit[idx]}'`;
    }
  }
  for (const [seq, single] of CONFUSABLE_SEQUENCES) {
    // candidate uses the sequence where the legit name has the single char
    for (let i = 0; i + 2 <= cand.length; i++) {
      if (
        cand.startsWith(seq, i) &&
        cand.slice(0, i) + single + cand.slice(i + 2) === legit
      ) {
        return `'${seq}' used in place of '${single}'`;
      }
    }
    // candidate uses the single char where the legit name has the sequence
    for (let i = 0; i + 2 <= legit.length; i++) {
      if (
        legit.startsWith(seq, i) &&
        legit.slice(0, i) + single + legit.slice(i + 2) === cand
      ) {
        return `'${single}' used in place of '${seq}'`;
      }
    }
  }
  return null;
}

/**
 * Describes a single Damerau-Levenshtein edit (substitution, insertion,
 * omission, adjacent transposition) turning `legit` into `cand`, else null.
 */
function singleEditReason(cand: string, legit: string): string | null {
  if (cand === legit) return null;
  if (cand.length === legit.length) {
    const diffs: number[] = [];
    for (let i = 0; i < cand.length; i++) if (cand[i] !== legit[i]) diffs.push(i);
    if (diffs.length === 1) {
      const i = diffs[0];
      return `one character substituted: '${cand[i]}' for '${legit[i]}'`;
    }
    if (
      diffs.length === 2 &&
      diffs[1] === diffs[0] + 1 &&
      cand[diffs[0]] === legit[diffs[1]] &&
      cand[diffs[1]] === legit[diffs[0]]
    ) {
      return `two adjacent characters transposed: '${legit[diffs[0]]}${legit[diffs[1]]}' became '${cand[diffs[0]]}${cand[diffs[1]]}'`;
    }
    return null;
  }
  if (cand.length === legit.length + 1) {
    for (let i = 0; i < cand.length; i++) {
      if (cand.slice(0, i) + cand.slice(i + 1) === legit) {
        return `one extra character inserted: '${cand[i]}'`;
      }
    }
    return null;
  }
  if (cand.length === legit.length - 1) {
    for (let i = 0; i < legit.length; i++) {
      if (legit.slice(0, i) + legit.slice(i + 1) === cand) {
        return `one character omitted: '${legit[i]}'`;
      }
    }
  }
  return null;
}

type Confidence = "high" | "low";
interface LookalikeMatch {
  confidence: Confidence;
  domain: string;
  reason: string;
}

function compareToLegit(
  hostname: string,
  hostLabels: string[],
  legit: string,
): LookalikeMatch | null {
  const legitLabels = legit.toLowerCase().split(".");
  if (legitLabels.length < 2) return null;
  const legitSld = legitLabels[legitLabels.length - 2];
  const legitTld = legitLabels[legitLabels.length - 1];
  const candSld = hostLabels[hostLabels.length - 2];
  const candTld = hostLabels[hostLabels.length - 1];

  // Exact base match is the legit domain (or one of its subdomains) in effect.
  if (candSld === legitSld && candTld === legitTld) return null;

  if (candTld === legitTld) {
    const reason = confusableReason(candSld, legitSld);
    if (reason) return { confidence: "high", domain: legit, reason };
  }

  if (candSld.length >= MIN_LABEL_LENGTH && legitSld.length >= MIN_LABEL_LENGTH) {
    if (candSld === legitSld) {
      return {
        confidence: "low",
        domain: legit,
        reason: `same name '${legitSld}' under a different top-level domain ('.${candTld}' instead of '.${legitTld}')`,
      };
    }
    const reason = singleEditReason(candSld, legitSld);
    if (reason) return { confidence: "low", domain: legit, reason };
  }

  if (
    legitSld.length >= MIN_LABEL_LENGTH &&
    hostLabels.slice(0, -2).includes(legitSld)
  ) {
    return {
      confidence: "low",
      domain: legit,
      reason: `the name '${legitSld}' is embedded as a separate label of a different domain ('${candSld}.${candTld}')`,
    };
  }
  return null;
}

function findLookalike(
  hostname: string,
  list: KnownLegitimateDomainList,
): LookalikeMatch | null {
  const hostLabels = hostname.split(".");
  if (hostLabels.length < 2) return null;
  // Never flag the real domain or its real subdomains.
  if (list.domains.some((d) => hostnameMatchesDomain(hostname, d))) return null;

  let firstLow: LookalikeMatch | null = null;
  for (const legit of list.domains) {
    const m = compareToLegit(hostname, hostLabels, legit);
    if (!m) continue;
    if (m.confidence === "high") return m;
    if (!firstLow) firstLow = m;
  }
  return firstLow;
}

export function domainHeuristic(
  url: string,
  tldList: ElevatedAttentionTldList,
  legitimateDomains?: KnownLegitimateDomainList,
): DeterministicFinding[] {
  const hostname = parseHostname(url);
  if (!hostname) return [];
  const findings: DeterministicFinding[] = [];
  const labels = hostname.split(".");

  if (labels.length >= 2) {
    const tld = labels[labels.length - 1];
    const listed = tldList.tlds.some(
      (t) => t.trim().toLowerCase().replace(/^\./, "") === tld,
    );
    if (listed) {
      findings.push({
        id: `elevated_attention_tld:${url}`,
        source: "deterministic",
        check: "domain_heuristic",
        category: "elevated_attention_tld",
        label: "Elevated-attention TLD",
        evidence: `The top-level domain ".${tld}" of "${hostname}" appears on the elevated-attention list, which warrants extra review. A TLD alone is not evidence that the domain is fraudulent.`,
        url,
        reference: `elevatedAttentionTlds.json v${tldList.version} (${tldList.source}, ${tldList.date})`,
        severity: "info",
        weight: SCORING_WEIGHTS.deterministic.elevated_attention_tld,
      });
    }
  }

  if (legitimateDomains && isLookalikeCheckActive(legitimateDomains)) {
    const m = findLookalike(hostname, legitimateDomains);
    if (m) {
      const high = m.confidence === "high";
      findings.push({
        id: `lookalike:${url}`,
        source: "deterministic",
        check: "domain_heuristic",
        category: "lookalike",
        label: high
          ? "Lookalike domain"
          : "Possible lookalike domain — Needs manual verification",
        evidence: `The hostname "${hostname}" resembles the known domain "${m.domain}": ${m.reason}.${
          high ? "" : " This is a low-confidence match and needs manual verification."
        }`,
        url,
        suspectedLegitDomain: m.domain,
        needsManualVerification: high ? undefined : true,
        reference: `${legitimateDomains.version} (${legitimateDomains.source}, ${legitimateDomains.date})`,
        severity: high ? "medium" : "low",
        weight: high
          ? SCORING_WEIGHTS.deterministic.lookalike_high
          : SCORING_WEIGHTS.deterministic.lookalike_low,
      });
    }
  }
  return findings;
}
