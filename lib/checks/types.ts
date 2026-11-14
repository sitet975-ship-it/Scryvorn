/**
 * Types for the deterministic check engine (pure, rule-based checks).
 * Types only: no runtime logic.
 */

export type CheckName =
  | "url_extraction"
  | "https_status"
  | "shortener"
  | "domain_heuristic"
  | "scam_triggers"
  | "domain_age";

export interface DeterministicFinding {
  id: string;
  source: "deterministic";
  check: CheckName;
  /**
   * e.g. "https_status" | "shortener" | "elevated_attention_tld" | "lookalike"
   * | "upfront_payment" | "domain_age_unavailable"
   */
  category: string;
  /** Human-readable check-type label. */
  label: string;
  /** Outcome description. */
  evidence: string;
  /** Affected URL (URL-based checks). */
  url?: string;
  /** Matched scam phrase (scam-trigger checks). */
  matchedText?: string;
  /** Suspected legitimate domain (lookalike findings). */
  suspectedLegitDomain?: string;
  /** True for low-confidence lookalikes ("Needs manual verification"). */
  needsManualVerification?: boolean;
  /** Cited reference-list version (shortener/TLD findings). */
  reference?: string;
  severity: "info" | "low" | "medium" | "high";
  /** Risk contribution; 0 = informational. */
  weight: number;
}

/** Checks that must all finish for a deterministic run to be "complete". */
export type RequiredCheckName = Exclude<CheckName, "domain_age">;

/**
 * Completion status of a deterministic run.
 * - "complete": every required check ran over the whole input.
 * - "incomplete": an unexpected internal failure stopped one or more required
 *   checks. Findings collected before the failure are kept, but the result
 *   must not be presented as a completed assessment (and never as
 *   "Low risk — still verify independently").
 *
 * An inactive lookalike check (no list injected) and an unavailable optional
 * domain-age lookup are expected states, not failures; neither makes a run
 * "incomplete".
 */
export type DeterministicRunStatus = "complete" | "incomplete";

export interface DeterministicResult {
  findings: DeterministicFinding[];
  /** Whether every required check finished. */
  status: DeterministicRunStatus;
  /**
   * Required checks that did not finish for the whole input, in pipeline
   * order. Empty if and only if `status` is "complete". Contains check names
   * only: never exception text or user input.
   */
  incompleteChecks: RequiredCheckName[];
  /**
   * False when the domain-age lookup was unconfigured or failed, or when it
   * was skipped because the run was incomplete.
   */
  domainAgeAvailable: boolean;
  /**
   * Configuration, not execution: true when a non-empty known-legitimate-domain
   * list was injected, so lookalike comparison was enabled for this run.
   * It does not prove the comparison ran for every URL; that holds only when
   * `incompleteChecks` does not include "domain_heuristic".
   * False means lookalike checking was NOT performed (inactive), not that any
   * domain passed it.
   */
  lookalikeCheckActive: boolean;
}

/** Versioned URL-shortener domain list (data/shorteners.json). */
export interface ShortenerList {
  version: string;
  source: string;
  date: string;
  domains: string[];
}

/** Versioned elevated-attention TLD list (data/elevatedAttentionTlds.json). */
export interface ElevatedAttentionTldList {
  version: string;
  source: string;
  date: string;
  tlds: string[];
}

export interface ScamTriggerCategory {
  id: string;
  label: string;
  phrases: string[];
}

/** Versioned scam-trigger phrase sets (data/scamTriggers.json). */
export interface ScamTriggerSet {
  version: string;
  source: string;
  date: string;
  categories: ScamTriggerCategory[];
}

/** Injectable, reviewed list of known-legitimate domains. None is bundled. */
export interface KnownLegitimateDomainList {
  version: string;
  source: string;
  date: string;
  domains: string[];
}

/** Resolves a domain's registration age in days, or null if unavailable. */
export type DomainAgeLookupFn = (domain: string) => Promise<number | null>;
