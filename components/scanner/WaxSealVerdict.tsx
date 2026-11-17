import { useId } from "react";
import { SEVERITY_TIERS } from "@/lib/constants";
import type { ScanResult } from "@/lib/types";
import {
  INCOMPLETE_ASSESSMENT_NOTICE,
  knownCheckLabel,
  partitionDeterministicFindings,
} from "@/lib/report/evidenceReport";
import { AI_SUMMARY_LABEL, PLAIN_HEADING, aiSummary, ruleSummary } from "@/lib/report/plainLanguage";
import { defangText } from "@/lib/report/safeMarkdown";

/**
 * Verdict area.
 *
 * Complete run: a seal whose ring uses the tier color from SEVERITY_TIERS
 * (looked up by tier, not taken from free-form data). The tier text and the
 * score are always ivory on the dark card, so they stay readable for every
 * tier; color is a supplementary cue only. Beside the seal: a short summary
 * of the scored findings. The full itemized evidence stays in Verified Checks
 * and AI Interpretation. The tier text is the real SeverityTier from the scan
 * result; no fixed verdict wording is ever shown.
 *
 * Incomplete run (Req 6.9): a neutral, uncolored panel with the exact
 * incomplete notice and the unfinished checks. No score, tier, tier color, or
 * seal is shown.
 *
 * This component never uses the word "safe".
 */
export const VERDICT_HEADING = "Verdict";
export const SCORE_NOTE =
  "Uncalibrated heuristic score: not a probability or a fraud verdict.";
export const NO_SCORED_SUMMARY =
  "No scored findings contributed to this score. A low score does not mean the message is harmless.";
export const SEE_EVIDENCE_NOTE = "Full evidence is listed in Verified Checks and AI Interpretation.";
export const INCOMPLETE_FINDINGS_NOTE =
  "Deterministic evidence collected before the interruption is listed in Verified Checks.";

const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3 } as const;
const SEVERITY_WORD = { info: "Informational", low: "Low", medium: "Medium", high: "High" } as const;

export function scoredSummary(result: ScanResult): string {
  const { scored } = partitionDeterministicFindings(result.deterministicFindings);
  const ai = result.aiAvailable ? result.aiFindings.filter((f) => f.weight > 0) : [];
  const total = scored.length + ai.length;
  if (total === 0) return NO_SCORED_SUMMARY;
  let highest: keyof typeof SEVERITY_RANK = "info";
  for (const f of [...scored, ...ai]) {
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[highest]) highest = f.severity;
  }
  const noun = (n: number) => (n === 1 ? "finding" : "findings");
  return `${total} scored ${noun(total)} (${scored.length} rule-based, ${ai.length} AI). Highest finding severity: ${SEVERITY_WORD[highest]}.`;
}

const H2 = "text-xs font-semibold uppercase tracking-[0.2em] text-scry-amber";

/**
 * `compact`: always stack the seal above the tier text (used in narrow
 * columns, such as the Evidence-preserved side panel).
 */
export function WaxSealVerdict({ result, compact = false }: { result: ScanResult; compact?: boolean }) {
  const id = useId();
  const headingId = `${id}-heading`;

  if (result.deterministicStatus === "incomplete") {
    return (
      <section aria-labelledby={headingId} data-section="verdict" data-verdict="incomplete" className="flex flex-col gap-3">
        <h2 id={headingId} className={H2}>
          {VERDICT_HEADING}
        </h2>
        {/* Neutral, uncoloured panel: no score, tier, tier colour, or seal. */}
        <div className="rounded-sm border-2 border-dashed border-scry-ivory/40 p-4 text-scry-ivory">
          <p className="font-serif text-2xl font-semibold leading-snug">{INCOMPLETE_ASSESSMENT_NOTICE}</p>
          <p className="mt-3 text-sm font-semibold">Unfinished required checks:</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {result.incompleteChecks.map((c) => (
              <li key={c} data-unfinished={c}>
                {knownCheckLabel(c) ?? defangText(c)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-scry-muted">{INCOMPLETE_FINDINGS_NOTE}</p>
        </div>
      </section>
    );
  }

  const tier = SEVERITY_TIERS.find((t) => t.tier === result.severityTier);
  const ringColor = tier?.color;

  return (
    <section aria-labelledby={headingId} data-section="verdict" data-verdict="complete" className="flex flex-col gap-3">
      <h2 id={headingId} className={H2}>
        {VERDICT_HEADING}
      </h2>
      <div
        className="flex flex-col gap-5 rounded-sm border border-scry-border bg-scry-crimson/10 p-5"
        style={ringColor ? { boxShadow: `inset 3px 0 0 ${ringColor}` } : undefined}
      >
        <div className={`flex flex-col items-start gap-5 ${compact ? "" : "sm:flex-row sm:items-center"}`}>
        <div
          data-wax-seal=""
          style={ringColor ? { borderColor: ringColor, boxShadow: `0 0 22px -6px ${ringColor}` } : undefined}
          className="flex h-[7.5rem] w-[7.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-scry-ivory/30 bg-scry-bg px-3 text-center text-scry-ivory"
        >
          {/* Inner diameter ~112 px; the label (~70 px wide) sits well inside the ring. */}
          <span data-seal-label="" className="whitespace-nowrap text-[0.625rem] font-semibold uppercase leading-none tracking-[0.06em] text-scry-muted">
            Risk score
          </span>
          <span data-score="" className="font-serif text-4xl font-semibold leading-none tabular-nums">
            {result.riskScore}
          </span>
          <span className="text-xs tabular-nums text-scry-muted">/ 100</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* break-normal + hyphens-none: words wrap only at spaces, never mid-word. */}
          <p
            data-tier=""
            className={`font-serif text-2xl font-semibold leading-snug text-scry-ivory break-normal hyphens-none text-balance ${compact ? "" : "sm:text-3xl"}`}
          >
            {result.severityTier}
          </p>
          <p data-summary="" className="text-sm text-scry-ivory">
            {scoredSummary(result)}
          </p>
          <p className="text-sm text-scry-muted">{SEE_EVIDENCE_NOTE}</p>
          <p className="text-sm font-semibold text-scry-ivory">{SCORE_NOTE}</p>
        </div>
        </div>
        {/* Plain-English reading of the actual findings (lib/report/plainLanguage). */}
        <div data-plain-summary="" className="border-t border-scry-border pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-scry-amber">{PLAIN_HEADING}</h3>
          <p data-plain-rules="" className="mt-2 text-sm leading-relaxed text-scry-ivory">
            {ruleSummary(result)}
          </p>
          <p data-plain-ai="" className="mt-2 text-sm leading-relaxed text-scry-ivory">
            <span className="font-semibold text-scry-green">{AI_SUMMARY_LABEL}</span> {aiSummary(result)}
          </p>
        </div>
      </div>
    </section>
  );
}
