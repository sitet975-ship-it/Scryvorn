import { SCORING_WEIGHTS } from "@/lib/constants";
import type { DeterministicFinding, DomainAgeLookupFn } from "./types";

/** Injected domain-age lookup service (spec name). Returns age in days. */
export type DomainAgeService = DomainAgeLookupFn;

/**
 * Default per-lookup wait limit (documented in design.md, "Domain-age lookup
 * timing"). The timeout stops waiting only; it does not cancel the injected
 * service, whose signature has no abort signal.
 */
export const DOMAIN_AGE_TIMEOUT_MS = 5000;

/**
 * Looks up a domain's registration age via an injected service.
 * Returns a finding on success, or null when the service is missing,
 * throws/rejects, times out, or returns an unusable value. Never throws.
 * Makes no network request of its own.
 */
export async function lookupDomainAge(
  domain: string,
  service?: DomainAgeService,
  opts?: { timeoutMs?: number },
): Promise<DeterministicFinding | null> {
  if (!service) return null;
  const timeoutMs = opts?.timeoutMs ?? DOMAIN_AGE_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const result = await Promise.race([
      Promise.resolve().then(() => service(domain)),
      timeout,
    ]);
    if (typeof result !== "number" || !Number.isFinite(result) || result < 0) {
      return null;
    }
    return buildFinding(domain, Math.floor(result));
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function buildFinding(domain: string, days: number): DeterministicFinding {
  const w = SCORING_WEIGHTS.deterministic;
  const young = days < w.domain_age_young_days;
  const base = `Registered about ${days} days ago (reported by configured lookup service).`;
  return {
    id: `domain_age:${domain}`,
    source: "deterministic",
    check: "domain_age",
    category: "domain_age",
    label: "Domain registration age",
    evidence: young
      ? `${base} A recently registered domain is a risk signal, not proof of fraud.`
      : `${base} Domain age alone does not indicate trustworthiness.`,
    url: domain,
    severity: young ? "low" : "info",
    weight: young ? w.domain_age_young : 0,
  };
}

/** Informational note used when domain-age data could not be obtained. */
export function domainAgeUnavailableFinding(
  reason: "not_configured" | "lookup_failed",
): DeterministicFinding {
  const why =
    reason === "not_configured"
      ? "no domain-age lookup service is configured"
      : "the domain-age lookup failed";
  return {
    id: `domain_age_unavailable:${reason}`,
    source: "deterministic",
    check: "domain_age",
    category: "domain_age_unavailable",
    label: "Domain registration age unavailable",
    evidence: `Domain-age data is unavailable (${why}); the scan completed without it. This means no age data was obtained, not that the domain is established.`,
    severity: "info",
    weight: SCORING_WEIGHTS.deterministic.domain_age_unavailable,
  };
}
