import type { DeterministicFinding } from "@/lib/checks/types";
import type { ScanResult } from "@/lib/types";
import { aiUnavailableNotice, partitionDeterministicFindings } from "./evidenceReport";
import { defangText } from "./safeMarkdown";

/**
 * Plain-English explanation layer ("What this means").
 *
 * Every sentence is derived from the actual result: the category of each
 * scored deterministic finding (fixed, reviewed wording below), the AI
 * findings' own labels, and the AI availability state. Nothing here adds a
 * finding, asserts certainty, or calls a message safe, legitimate, or
 * fraudulent. Categories without reviewed wording get no explanation rather
 * than an invented one.
 */
export const PLAIN_HEADING = "What this means";
export const AI_SUMMARY_LABEL = "AI interpretation (model-generated, not verified fact):";

export const NO_RULE_FINDINGS_SUMMARY =
  "Scryvorn did not find rule-based scam phrases or risky link patterns in this text. That does not prove the message is genuine—use your own judgment and verify independently.";
export const AI_NO_FINDINGS_SUMMARY =
  "The model reported no additional patterns. That does not prove the message is genuine.";

interface Wording {
  /** Short noun phrase used in the verdict summary. */
  phrase: string;
  /** One- or two-sentence explanation shown on the evidence card. */
  explanation: string;
}

/** Reviewed wording for each scored finding category the engine can produce. */
export const FINDING_WORDING: Readonly<Record<string, Wording>> = Object.freeze({
  upfront_payment: {
    phrase: "a request to pay up front",
    explanation:
      "This asks you to pay before receiving anything. Real employers and services normally do not require upfront payment.",
  },
  credential_request: {
    phrase: "a request for passwords, codes, or identity details",
    explanation:
      "This asks for login details, one-time codes, or identity checks. Organizations rarely ask for these by message; open their official app or website yourself instead.",
  },
  urgency_pressure: {
    phrase: "pressure to act quickly",
    explanation:
      "This pressures you to act quickly. Urgency can be used to stop you from checking carefully.",
  },
  off_platform_move: {
    phrase: "a push to continue the conversation on another app",
    explanation:
      "This tries to move the conversation to another app. Be cautious before sharing personal information or money.",
  },
  crypto_payment_demand: {
    phrase: "a request for cryptocurrency payment",
    explanation:
      "This asks for payment in cryptocurrency. Crypto payments are hard to reverse, so verify the request through an official channel first.",
  },
  suspicious_job_offer: {
    phrase: "job-offer wording that often appears in scams",
    explanation:
      "This uses job-offer wording that often appears in scams, such as easy money or no experience needed. Research the employer independently before responding.",
  },
  shortener: {
    phrase: "a shortened link that can hide its real destination",
    explanation:
      "This link pattern may not lead where it appears to lead. Do not enter passwords or payment details until you verify it independently.",
  },
  lookalike: {
    phrase: "a link whose domain resembles a known domain",
    explanation:
      "This link's domain resembles a known domain. Check the address carefully and do not enter passwords or payment details until you verify it independently.",
  },
  domain_age: {
    phrase: "a link to a recently registered domain",
    explanation:
      "This link points to a recently registered domain. New domains can be used for short-lived scams, so verify the site independently.",
  },
});

const wordingFor = (category: string): Wording | null =>
  Object.prototype.hasOwnProperty.call(FINDING_WORDING, category) ? FINDING_WORDING[category] : null;

/** Explanation for one finding, or null (not scored, or no reviewed wording). */
export function explainFinding(finding: DeterministicFinding): string | null {
  if (!(finding.weight > 0)) return null;
  return wordingFor(finding.category)?.explanation ?? null;
}

/** "a", "a and b", "a, b, and c". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Verdict summary of the rule-based (deterministic) evidence. */
export function ruleSummary(result: ScanResult): string {
  const { scored } = partitionDeterministicFindings(result.deterministicFindings);
  if (scored.length === 0) return NO_RULE_FINDINGS_SUMMARY;
  const phrases: string[] = [];
  for (const f of scored) {
    const p = wordingFor(f.category)?.phrase ?? defangText(f.label);
    if (p && !phrases.includes(p)) phrases.push(p);
  }
  return `Scryvorn found patterns that can appear in scams. This message includes ${joinList(phrases)}. Pause before acting and verify through an official channel.`;
}

/** Verdict summary of the AI layer, derived only from the actual AI outcome. */
export function aiSummary(result: ScanResult): string {
  if (!result.aiAvailable) return aiUnavailableNotice(result.aiUnavailableReason);
  const n = result.aiFindings.length;
  if (n === 0) return AI_NO_FINDINGS_SUMMARY;
  const shown = result.aiFindings.slice(0, 3).map((f) => defangText(f.label).replace(/[.\s]+$/, ""));
  const more = n > 3 ? `; and ${n - 3} more` : "";
  const count = n === 1 ? "one pattern" : `${n} patterns`;
  return `The model pointed to ${count}: ${shown.join("; ")}${more}. These are model interpretations, not verified facts.`;
}
