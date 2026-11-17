import type { CheckName } from "@/lib/checks/types";

/**
 * Provenance of a displayed finding: which layer produced it.
 * - message_rules: scam-trigger phrase rules applied to the message text.
 * - link_checks: rule-based checks on extracted URLs and domains.
 * - ai_interpretation: the AI model's interpretation (not a verified fact).
 */
export type EvidenceSource = "message_rules" | "link_checks" | "ai_interpretation";

export const SOURCE_LABELS: Readonly<Record<EvidenceSource, string>> = Object.freeze({
  message_rules: "Message rules",
  link_checks: "Link checks",
  ai_interpretation: "AI interpretation",
});

const DETERMINISTIC_SOURCE: Readonly<Record<CheckName, EvidenceSource>> = Object.freeze({
  scam_triggers: "message_rules",
  url_extraction: "link_checks",
  https_status: "link_checks",
  shortener: "link_checks",
  domain_heuristic: "link_checks",
  domain_age: "link_checks",
});

/** Source layer for a deterministic check. */
export function deterministicSource(check: CheckName): EvidenceSource {
  return DETERMINISTIC_SOURCE[check];
}
