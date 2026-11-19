import elevatedAttentionTlds from "@/data/elevatedAttentionTlds.json";
import scamTriggers from "@/data/scamTriggers.json";
import shorteners from "@/data/shorteners.json";
import urlRiskSignals from "@/data/urlRiskSignals.json";
import { domainAgeUnavailableFinding, lookupDomainAge } from "./domainAgeLookup";
import { domainHeuristic, isLookalikeCheckActive } from "./domainHeuristic";
import { checkHttps } from "./httpsValidator";
import { parseHostname } from "./hostname";
import { detectScamTriggers } from "./scamTriggerDetector";
import { detectShortener } from "./shortenerDetector";
import type {
  DeterministicFinding,
  DeterministicResult,
  DomainAgeLookupFn,
  ElevatedAttentionTldList,
  KnownLegitimateDomainList,
  RequiredCheckName,
  ScamTriggerSet,
  ShortenerList,
  UrlRiskSignals,
} from "./types";
import { extractUrls } from "./urlExtractor";
import { checkUrlStructure } from "./urlStructure";

const SHORTENER_LIST: ShortenerList = shorteners;
const TLD_LIST: ElevatedAttentionTldList = elevatedAttentionTlds;
const TRIGGER_SET: ScamTriggerSet = scamTriggers;
const URL_SIGNALS: UrlRiskSignals = urlRiskSignals;

/** Required checks, in pipeline order. Domain age is optional. */
const REQUIRED_CHECKS: readonly RequiredCheckName[] = [
  "url_extraction",
  "https_status",
  "shortener",
  "domain_heuristic",
  "url_structure",
  "scam_triggers",
];

export interface DeterministicEngineOptions {
  /** Injected domain-age lookup (days since registration, or null). */
  domainAgeLookup?: DomainAgeLookupFn;
  /**
   * Injected known-legitimate-domain list. None is bundled; when absent or
   * empty the lookalike check is inactive (not performed, NOT "passed").
   */
  legitimateDomains?: KnownLegitimateDomainList;
  /** Per-lookup timeout for the domain-age service, in milliseconds. */
  domainAgeTimeoutMs?: number;
}

/**
 * Orchestrates the deterministic checks in a fixed order:
 *  1. extractUrls(input)
 *  2. for each unique URL, in extraction order: checkHttps, detectShortener
 *     (if it flags), domainHeuristic, checkUrlStructure
 *  3. detectScamTriggers(input)
 *  4. optional domain-age lookup
 *
 * Domain-age rules (unique parsed hostnames, first-seen order, sequential):
 *  - No URLs: no lookup, no note, domainAgeAvailable = false.
 *  - URLs but no lookup configured: one "not_configured" note, available = false.
 *  - Lookup configured: each non-null result is added as a finding.
 *    All null -> one "lookup_failed" note, available = false.
 *    At least one success -> available = true; if some also failed, one
 *    "lookup_failed" note is appended too.
 *
 * Completion status:
 *  - Each required check is marked finished only after it has run over the
 *    whole input (per-URL checks: after the last URL).
 *  - An unexpected internal failure stops the required checks. Findings
 *    collected so far are kept, `status` is "incomplete", and
 *    `incompleteChecks` lists the required checks that did not finish.
 *    No exception text or user input is recorded.
 *  - When the run is incomplete, the optional domain-age stage is skipped
 *    (no lookup, no note, domainAgeAvailable = false).
 *  - Domain-age problems never make a run incomplete; they use the
 *    informational note described above.
 *
 * Never fetches, crawls, resolves, or visits user URLs (structure and
 * metadata only); the only I/O is whatever the injected lookup performs.
 * Does not log input or findings. Does not compute the Risk_Score.
 * Never throws for string input.
 */
export async function runDeterministicChecks(
  input: string,
  opts?: DeterministicEngineOptions,
): Promise<DeterministicResult> {
  const findings: DeterministicFinding[] = [];
  const lookalikeCheckActive = isLookalikeCheckActive(opts?.legitimateDomains);
  const text = typeof input === "string" ? input : "";
  const finished = new Set<RequiredCheckName>();
  let urls: string[] = [];

  try {
    // 1. URL extraction (deduplicated, order preserved).
    urls = Array.from(new Set(extractUrls(text)));
    finished.add("url_extraction");

    // 2. Per-URL checks.
    for (const url of urls) {
      findings.push(checkHttps(url));
      const shortener = detectShortener(url, SHORTENER_LIST);
      if (shortener) findings.push(shortener);
      findings.push(...domainHeuristic(url, TLD_LIST, opts?.legitimateDomains));
      findings.push(...checkUrlStructure(url, URL_SIGNALS));
    }
    finished.add("https_status");
    finished.add("shortener");
    finished.add("domain_heuristic");
    finished.add("url_structure");

    // 3. Scam triggers.
    findings.push(...detectScamTriggers(text, TRIGGER_SET));
    finished.add("scam_triggers");
  } catch {
    // Unexpected internal failure. Deliberately records no error details;
    // the unfinished checks are reported through `incompleteChecks`.
  }

  const incompleteChecks = REQUIRED_CHECKS.filter((c) => !finished.has(c));
  const status = incompleteChecks.length === 0 ? "complete" : "incomplete";

  // 4. Domain age (optional). Only runs after the required checks completed.
  let domainAgeAvailable = false;
  if (status === "complete" && urls.length > 0) {
    let succeeded = 0;
    try {
      const hostnames: string[] = [];
      for (const url of urls) {
        const host = parseHostname(url);
        if (host && !hostnames.includes(host)) hostnames.push(host);
      }

      if (!opts?.domainAgeLookup) {
        findings.push(domainAgeUnavailableFinding("not_configured"));
      } else {
        let failed = 0;
        for (const host of hostnames) {
          const f = await lookupDomainAge(host, opts.domainAgeLookup, {
            timeoutMs: opts.domainAgeTimeoutMs,
          });
          if (f) {
            findings.push(f);
            succeeded++;
          } else {
            failed++;
          }
        }
        if (failed > 0 || hostnames.length === 0) {
          findings.push(domainAgeUnavailableFinding("lookup_failed"));
        }
      }
    } catch {
      // Optional stage: fall back to the informational note.
      findings.push(domainAgeUnavailableFinding("lookup_failed"));
    }
    domainAgeAvailable = succeeded > 0;
  }

  return { findings, status, incompleteChecks, domainAgeAvailable, lookalikeCheckActive };
}
