import { FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import type { AiFinding } from "@/lib/ai/types";
import type { CheckName, DeterministicFinding } from "@/lib/checks/types";
import type { ScanResult } from "@/lib/types";
import { toSafeMarkdownText as md } from "./safeMarkdown";

/**
 * Evidence_Report builder (pure Markdown).
 *
 * All values that come from findings, AI output, or steps are passed through
 * toSafeMarkdownText (escaped and defanged). The ScanResult is not modified.
 * The report never states that a message is safe and never presents absent
 * findings as proof of safety.
 */

export const INCOMPLETE_ASSESSMENT_NOTICE =
  "Assessment incomplete — no overall risk score or tier assigned.";
export const LOOKALIKE_INACTIVE_NOTICE =
  "Lookalike checking was not performed because no reviewed reference list is configured. This is not a passed check.";
export const LOOKALIKE_CONFIGURED_NOTICE =
  "Lookalike checking is configured with a reference list. Configuration alone does not prove the check ran for every URL.";
export const AI_UNAVAILABLE_NOTICE = "AI analysis unavailable";
export const INFORMATIONAL_CONTEXT_NOTICE =
  "These findings add no risk score. They are context, not evidence that a link is safe or fraudulent.";
export const AI_NO_FINDINGS_NOTICE =
  "The AI interpretation reported no findings. This is not proof that the message is safe.";
export const AI_FINDINGS_ARE_INTERPRETATION_NOTICE =
  "AI findings are model interpretations of the message text, with the model's confidence. They are not verified facts or proof of fraud.";
export const DOMAIN_AGE_SKIPPED_NOTICE =
  "Domain age: skipped because the required checks did not complete.";

/** "AI analysis unavailable (<reason>)." */
export function aiUnavailableNotice(reason: "timeout" | "error" | undefined): string {
  const why =
    reason === "timeout"
      ? "the AI service did not respond in time"
      : "the AI service returned an error or an unusable response";
  return `${AI_UNAVAILABLE_NOTICE} (${why}).`;
}

/** Sentence for a required check that did not finish. */
export function unfinishedCheckNotice(label: string): string {
  return `${label}: did not finish because of an unexpected internal failure. A missing finding here is not a passed check.`;
}

export const STEPS_ARE_RECOMMENDATIONS_NOTICE =
  "These are recommendations for you to carry out. Scryvorn did not visit, open, or confirm any link or destination.";

export const REPORT_SECTIONS = [
  "Assessment status and coverage",
  "Scored deterministic findings",
  "Informational context",
  "Checks not performed / unavailable",
  "AI interpretation",
  "Recommended verification steps",
  "Advisory disclaimer",
] as const;

/** Thrown for a scan timestamp that is invalid or has no UTC marker/offset. */
export class InvalidTimestampError extends Error {
  constructor() {
    super(
      "Scan timestamp must be an ISO 8601 date-time (YYYY-MM-DDTHH:mm[:ss[.fraction]]) with an explicit UTC marker (Z) or numeric offset (±HH:MM or ±HHMM).",
    );
    this.name = "InvalidTimestampError";
  }
}

const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:([Zz])|([+-])(\d{2}):?(\d{2}))$/;

/**
 * Parses a scan timestamp into a UTC Date. Requires "Z" or a numeric offset
 * and a real calendar date and time. Never substitutes the current time.
 */
export function parseScanTimestamp(timestamp: string): Date {
  if (typeof timestamp !== "string") throw new InvalidTimestampError();
  const m = TIMESTAMP_RE.exec(timestamp);
  if (!m) throw new InvalidTimestampError();

  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const millis = m[7] === undefined ? 0 : Number(m[7].slice(0, 3).padEnd(3, "0"));
  const offsetSign = m[9] === "-" ? -1 : 1;
  const offsetHours = m[10] === undefined ? 0 : Number(m[10]);
  const offsetMinutes = m[11] === undefined ? 0 : Number(m[11]);

  const daysInMonth = new Date(Date.UTC(2000, month, 0)).getUTCDate();
  const leapAdjusted =
    month === 2 && !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 28 : daysInMonth;
  if (
    month < 1 || month > 12 ||
    day < 1 || day > leapAdjusted ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHours > 23 || offsetMinutes > 59
  ) {
    throw new InvalidTimestampError();
  }

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millis);
  const utc = new Date(local.getTime() - offsetSign * (offsetHours * 60 + offsetMinutes) * 60_000);
  const utcYear = utc.getUTCFullYear();
  if (!Number.isFinite(utc.getTime()) || utcYear < 0 || utcYear > 9999) {
    throw new InvalidTimestampError();
  }
  return utc;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function utcParts(d: Date) {
  return {
    date: `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`,
    display: `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`,
  };
}

/** `scryvorn-report-YYYYMMDD-HHmmss.md` in UTC. Throws InvalidTimestampError. */
export function reportFilename(timestamp: string): string {
  const { date, time } = utcParts(parseScanTimestamp(timestamp));
  return `scryvorn-report-${date}-${time}.md`;
}

export const CHECK_LABELS: Readonly<Record<CheckName, string>> = Object.freeze({
  url_extraction: "URL extraction",
  https_status: "HTTPS status",
  shortener: "URL-shortener detection",
  domain_heuristic: "Domain heuristics (elevated-attention TLD and lookalike)",
  scam_triggers: "Scam-trigger phrase detection",
  domain_age: "Domain age",
});

/** Fixed label for a known check, or null for an unknown name. */
export function knownCheckLabel(check: string): string | null {
  return Object.prototype.hasOwnProperty.call(CHECK_LABELS, check)
    ? CHECK_LABELS[check as CheckName]
    : null;
}

function checkLabel(check: string): string {
  return knownCheckLabel(check) ?? md(check);
}

/**
 * Groups deterministic findings the way the report presents them:
 * scored (weight > 0), informational (weight 0, not the domain-age note),
 * and domain-age-unavailable notes.
 */
export function partitionDeterministicFindings(findings: readonly DeterministicFinding[]) {
  const ageNotes = findings.filter((f) => f.category === "domain_age_unavailable");
  const scored = findings.filter((f) => f.category !== "domain_age_unavailable" && f.weight > 0);
  const informational = findings.filter(
    (f) => f.category !== "domain_age_unavailable" && !(f.weight > 0),
  );
  return { scored, informational, ageNotes };
}

function deterministicItem(f: DeterministicFinding, showWeight: boolean): string[] {
  const lines = [`- **${md(f.label)}**: ${md(f.evidence)}`];
  if (f.url) lines.push(`  - URL: ${md(f.url)}`);
  if (f.matchedText) lines.push(`  - Matched text: ${md(f.matchedText)}`);
  if (f.suspectedLegitDomain) {
    lines.push(`  - Resembles known domain: ${md(f.suspectedLegitDomain)}`);
  }
  if (f.needsManualVerification) lines.push("  - Needs manual verification");
  if (f.reference) lines.push(`  - Reference: ${md(f.reference)}`);
  if (showWeight) lines.push(`  - Score contribution: ${md(String(f.weight))}`);
  return lines;
}

function aiItem(f: AiFinding): string {
  return `- **${md(f.label)}** (${md(f.severity)} confidence; category: ${md(f.category)}): ${md(f.evidence)}`;
}

function sameSteps(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

export type StepSource = "standard" | "ai";

export const STEP_SOURCE_LABELS: Readonly<Record<StepSource, string>> = Object.freeze({
  standard: "Scryvorn's standard verification guidance",
  ai: "AI interpretation (model-generated; review before acting)",
});

/**
 * The single step-selection rule shared by the report and the UI.
 * AI steps are used only when AI is available and returned at least one step
 * (the AI layer already rejects blank or non-string steps). Otherwise the
 * reviewed FALLBACK_VERIFICATION_STEPS are used: supplied steps would be
 * inconsistent with an unavailable AI result. Steps identical to the fallback
 * list are labelled as standard guidance.
 */
export function selectRecommendedSteps(
  result: Pick<ScanResult, "aiAvailable" | "recommendedSteps">,
): { steps: readonly string[]; source: StepSource } {
  const steps =
    result.aiAvailable && result.recommendedSteps.length
      ? result.recommendedSteps
      : FALLBACK_VERIFICATION_STEPS;
  return { steps, source: sameSteps(steps, FALLBACK_VERIFICATION_STEPS) ? "standard" : "ai" };
}

/** Builds the Markdown Evidence_Report. Throws InvalidTimestampError. */
export function buildEvidenceReport(result: ScanResult): string {
  const when = utcParts(parseScanTimestamp(result.timestamp)).display;
  const complete = result.deterministicStatus === "complete";
  const { scored, informational, ageNotes } = partitionDeterministicFindings(
    result.deterministicFindings,
  );
  const unfinished = complete ? [] : result.incompleteChecks;

  const out: string[] = ["# Scryvorn Evidence Report", ""];
  const section = (i: number) => out.push(`## ${REPORT_SECTIONS[i]}`, "");

  // 1. Assessment status and coverage
  section(0);
  out.push(`- Scan time: ${when}`, `- Input type: ${md(result.inputType)}`);
  if (complete) {
    out.push(
      "- Deterministic checks: complete",
      `- Overall risk score: ${md(String(result.riskScore))} / 100 (uncalibrated heuristic score; not a probability, a fraud verdict, or a validated confidence estimate)`,
      `- Severity tier: ${md(result.severityTier)}`,
    );
  } else {
    out.push(
      `- **${INCOMPLETE_ASSESSMENT_NOTICE}**`,
      "- Deterministic checks: interrupted by an unexpected internal failure",
      "- Unfinished required checks:",
      ...unfinished.map((c) => `  - ${checkLabel(c)}`),
      "- Evidence collected before the interruption is still listed below.",
    );
  }
  out.push(
    `- Lookalike checking: ${result.lookalikeCheckActive ? LOOKALIKE_CONFIGURED_NOTICE : LOOKALIKE_INACTIVE_NOTICE}`,
    `- AI analysis: ${result.aiAvailable ? "available" : AI_UNAVAILABLE_NOTICE}`,
    "",
  );

  // 2. Scored deterministic findings
  section(1);
  if (scored.length) out.push(...scored.flatMap((f) => deterministicItem(f, true)));
  else out.push("No scored deterministic findings were produced. This is not proof that the message is safe.");
  out.push("");

  // 3. Informational context
  section(2);
  if (informational.length) {
    out.push(
      INFORMATIONAL_CONTEXT_NOTICE,
      "",
      ...informational.flatMap((f) => deterministicItem(f, false)),
    );
  } else {
    out.push("None.");
  }
  out.push("");

  // 4. Checks not performed / unavailable
  section(3);
  const notPerformed: string[] = [];
  if (!result.lookalikeCheckActive) notPerformed.push(`- ${LOOKALIKE_INACTIVE_NOTICE}`);
  for (const f of ageNotes) notPerformed.push(...deterministicItem(f, false));
  for (const c of unfinished) {
    notPerformed.push(`- ${unfinishedCheckNotice(checkLabel(c))}`);
  }
  if (!complete) {
    notPerformed.push(`- ${DOMAIN_AGE_SKIPPED_NOTICE}`);
  }
  if (!result.aiAvailable) notPerformed.push(`- AI interpretation: ${AI_UNAVAILABLE_NOTICE}.`);
  out.push(...(notPerformed.length ? notPerformed : ["None reported."]), "");

  // 5. AI interpretation
  section(4);
  if (!result.aiAvailable) {
    out.push(`${aiUnavailableNotice(result.aiUnavailableReason)} No AI findings are shown.`);
  } else if (result.aiFindings.length) {
    out.push(AI_FINDINGS_ARE_INTERPRETATION_NOTICE, "", ...result.aiFindings.map(aiItem));
  } else {
    out.push(AI_NO_FINDINGS_NOTICE);
  }
  out.push("");

  // 6. Recommended verification steps
  section(5);
  const { steps, source } = selectRecommendedSteps(result);
  out.push(
    STEPS_ARE_RECOMMENDATIONS_NOTICE,
    `Source: ${STEP_SOURCE_LABELS[source]}.`,
    "",
    ...steps.map((s, i) => `${i + 1}. ${md(s)}`),
    "",
  );

  // 7. Advisory disclaimer
  section(6);
  out.push(md(result.disclaimer), "");

  return out.join("\n");
}
