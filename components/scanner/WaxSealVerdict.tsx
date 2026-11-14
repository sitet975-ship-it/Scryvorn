import { useId } from "react";
import { SEVERITY_TIERS } from "@/lib/constants";
import type { ScanResult } from "@/lib/types";
import {
  INCOMPLETE_ASSESSMENT_NOTICE,
  knownCheckLabel,
  partitionDeterministicFindings,
} from "@/lib/report/evidenceReport";
import { defangText } from "@/lib/report/safeMarkdown";

/**
 * Verdict area.
 *
 * Complete run: a wax-seal-style stamp whose ring uses the tier color from
 * SEVERITY_TIERS (looked up by tier, not taken from free-form data). Score and
 * tier text are dark ink on parchment so they stay readable for every tier.
 * Beside the seal: a short summary of the scored findings (count and highest
 * severity). The full itemized evidence stays in Verified Checks and AI
 * Interpretation.
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

export function WaxSealVerdict({ result }: { result: ScanResult }) {
  const id = useId();
  const headingId = `${id}-heading`;

  if (result.deterministicStatus === "incomplete") {
    return (
      <section aria-labelledby={headingId} data-section="verdict" data-verdict="incomplete" className="flex flex-col gap-2">
        <h2 id={headingId} className="text-xl font-bold">
          {VERDICT_HEADING}
        </h2>
        <div className="rounded border-2 border-dashed border-dark-ink/40 p-4">
          <p className="font-bold">{INCOMPLETE_ASSESSMENT_NOTICE}</p>
          <p className="mt-2 text-sm font-medium">Unfinished required checks:</p>
          <ul className="list-disc pl-5 text-sm">
            {result.incompleteChecks.map((c) => (
              <li key={c} data-unfinished={c}>
                {knownCheckLabel(c) ?? defangText(c)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">{INCOMPLETE_FINDINGS_NOTE}</p>
        </div>
      </section>
    );
  }

  const tier = SEVERITY_TIERS.find((t) => t.tier === result.severityTier);
  const ringColor = tier?.color;

  return (
    <section aria-labelledby={headingId} data-section="verdict" data-verdict="complete" className="flex flex-col gap-2">
      <h2 id={headingId} className="text-xl font-bold">
        {VERDICT_HEADING}
      </h2>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          data-wax-seal=""
          style={ringColor ? { borderColor: ringColor } : undefined}
          className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-[10px] border-dark-ink/40 bg-aged-parchment text-dark-ink shadow-md"
        >
          <span className="text-xs font-semibold uppercase tracking-wide">Risk score</span>
          <span data-score="" className="text-3xl font-bold leading-none">
            {result.riskScore}
          </span>
          <span className="text-xs">/ 100</span>
        </div>
        <div className="flex flex-col gap-1">
          <p data-tier="" className="text-lg font-bold">
            {result.severityTier}
          </p>
          <p data-summary="" className="text-sm">
            {scoredSummary(result)}
          </p>
          <p className="text-sm">{SEE_EVIDENCE_NOTE}</p>
          <p className="text-xs">{SCORE_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
