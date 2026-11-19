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
  account_threat: {
    phrase: "a warning that your account is at risk",
    explanation:
      "This warns that your account is locked, suspended, or showing unusual activity. Check your account by opening the official app or website yourself, not through this message.",
  },
  prize_lure: {
    phrase: "a prize or reward you did not expect",
    explanation:
      "This says you have won something or have a reward waiting. Unexpected prizes are a common way to get personal details or a fee from you.",
  },
  gift_card_payment: {
    phrase: "a request to pay with gift cards",
    explanation:
      "This asks for payment with gift cards or their codes. Gift-card payments are hard to trace or reverse, and real organizations rarely ask for them.",
  },
  delivery_pretext: {
    phrase: "a parcel or delivery problem that needs action",
    explanation:
      "This claims a parcel is held or a delivery failed and asks you to act. Check the delivery through the courier's official app or website yourself.",
  },
  investment_lure: {
    phrase: "promises of unusually high or certain returns",
    explanation:
      "This promises fixed or unusually high returns. Real investments carry risk, so research the offer independently before sending money.",
  },
  ip_address_host: {
    phrase: "a link to a raw IP address instead of a website name",
    explanation:
      "This link goes to a number-only address instead of a named website. Organizations rarely send links like this, so do not sign in or pay through it.",
  },
  credentials_in_url: {
    phrase: "a link whose real destination is hidden after an \"@\"",
    explanation:
      "Everything before the \"@\" in this link is ignored by the browser, so the link opens a different site than it appears to. Do not use it.",
  },
  punycode_host: {
    phrase: "a web address with special characters that can imitate familiar letters",
    explanation:
      "This address uses encoded special characters, which can look like ordinary letters. Type the organization's address yourself instead of using this link.",
  },
  deceptive_domain_structure: {
    phrase: "a web address built to look like a different site",
    explanation:
      "This address puts a familiar ending such as \".com\" before its real domain, or hides the real domain behind many levels. Read the address from the right to see which site it belongs to.",
  },
  digit_letter_swap: {
    phrase: "a web address with digits standing in for letters",
    explanation:
      "This address uses digits like \"0\" or \"1\" in place of letters, a common way to imitate familiar names. Check the spelling carefully before trusting it.",
  },
  sensitive_host_keywords: {
    phrase: "official-sounding words such as \"login\" or \"verify\" in the web address",
    explanation:
      "The web address contains words like \"login\", \"secure\", or \"verify\". Anyone can put these words in an address, so they say nothing about who runs the site.",
  },
  sensitive_path_keywords: {
    phrase: "a link to a sign-in, verification, or payment page",
    explanation:
      "This link leads to a page about signing in, verifying, or paying. Reach those pages through the official app or website instead of a link in a message.",
  },
  many_hyphens: {
    phrase: "a long hyphenated web address",
    explanation:
      "This address strings many words together with hyphens, which is often used to make an address sound official. Check which domain it really belongs to.",
  },
  nonstandard_port: {
    phrase: "a link with an unusual port number",
    explanation:
      "This link specifies a port number, which ordinary websites rarely do in links they send. Treat it with extra care.",
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
