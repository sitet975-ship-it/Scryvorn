import type { DeterministicFinding } from "@/lib/checks/types";
import { knownCheckLabel } from "@/lib/report/evidenceReport";
import { PLAIN_HEADING, explainFinding } from "@/lib/report/plainLanguage";
import { SOURCE_LABELS, deterministicSource, type EvidenceSource } from "@/lib/report/provenance";
import { defangText } from "@/lib/report/safeMarkdown";

/** Readable metadata label: muted, modest tracking, not tiny. */
export const DT = "text-xs font-semibold uppercase tracking-[0.08em] text-scry-muted";

const BADGE: Record<EvidenceSource, string> = {
  message_rules: "border-scry-amber/50 text-scry-amber",
  link_checks: "border-scry-amber/50 text-scry-amber",
  ai_interpretation: "border-scry-green/50 text-scry-green",
};

/**
 * Provenance badge. Text always names the source (colour is supplementary),
 * so provenance never depends on colour alone.
 */
export function SourceBadge({ source }: { source: EvidenceSource }) {
  return (
    <span
      data-source={source}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${BADGE[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

/**
 * One deterministic finding. Scored evidence carries a crimson left rule and
 * its score contribution; context items use a plain border and never show a
 * contribution. All finding text is untrusted: rendered as plain React text
 * after defangText, and URLs are never clickable.
 */
export function EvidenceCard({ finding, scored }: { finding: DeterministicFinding; scored: boolean }) {
  const checkType = knownCheckLabel(finding.check) ?? defangText(finding.check);
  // Plain-English explanation for scored evidence only, from reviewed wording
  // keyed by the finding's category (null when there is none).
  const explanation = scored ? explainFinding(finding) : null;
  return (
    <li
      data-finding={finding.category}
      className={
        scored
          ? "rounded-sm border border-scry-border border-l-[3px] border-l-scry-crimson bg-scry-bg/60 p-4"
          : "rounded-sm border border-scry-border bg-scry-bg/40 p-4"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge source={deterministicSource(finding.check)} />
      </div>
      <p className="mt-2 font-serif text-lg font-semibold leading-snug text-scry-ivory">{defangText(finding.label)}</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className={DT}>Check</dt>
        <dd className="text-scry-ivory">{checkType}</dd>
        {finding.url ? (
          <>
            <dt className={DT}>URL</dt>
            <dd data-url="" className="break-all font-mono text-[0.8125rem] text-scry-ivory">
              {defangText(finding.url)}
            </dd>
          </>
        ) : null}
        <dt className={DT}>Outcome</dt>
        <dd className="font-medium text-scry-ivory">{defangText(finding.evidence)}</dd>
        {finding.matchedText ? (
          <>
            <dt className={DT}>Matched text</dt>
            <dd className="text-scry-ivory">“{defangText(finding.matchedText)}”</dd>
          </>
        ) : null}
        {finding.suspectedLegitDomain ? (
          <>
            <dt className={DT}>Resembles</dt>
            <dd className="break-all font-mono text-[0.8125rem] text-scry-ivory">{defangText(finding.suspectedLegitDomain)}</dd>
          </>
        ) : null}
        {finding.needsManualVerification ? (
          <>
            <dt className={DT}>Note</dt>
            <dd className="text-scry-ivory">Needs manual verification</dd>
          </>
        ) : null}
        {finding.reference ? (
          <>
            <dt className={DT}>Reference</dt>
            <dd className="break-words text-scry-muted">{defangText(finding.reference)}</dd>
          </>
        ) : null}
        {scored ? (
          <>
            <dt className={DT}>Score contribution</dt>
            <dd data-weight="" className="font-semibold tabular-nums text-scry-ivory">
              +{finding.weight}
            </dd>
          </>
        ) : null}
      </dl>
      {explanation ? (
        <div data-explanation="" className="mt-3 rounded-sm border-l-2 border-scry-amber/70 bg-scry-amber/[0.06] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-scry-amber">{PLAIN_HEADING}</p>
          <p className="mt-1 text-sm leading-relaxed text-scry-ivory">{explanation}</p>
        </div>
      ) : null}
    </li>
  );
}
