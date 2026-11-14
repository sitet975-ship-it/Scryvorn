import { useId } from "react";
import type { DeterministicFinding } from "@/lib/checks/types";
import type { ScanResult } from "@/lib/types";
import {
  DOMAIN_AGE_SKIPPED_NOTICE,
  INFORMATIONAL_CONTEXT_NOTICE,
  LOOKALIKE_INACTIVE_NOTICE,
  knownCheckLabel,
  partitionDeterministicFindings,
  unfinishedCheckNotice,
} from "@/lib/report/evidenceReport";
import { defangText } from "@/lib/report/safeMarkdown";

/**
 * Deterministic (rule-based) evidence only. AI findings are never rendered here.
 *
 * Sub-areas mirror the Evidence_Report:
 * - Findings: scored findings (weight > 0), with score contribution.
 * - Informational context: weight-0 findings, without any score contribution.
 * - Checks not performed / unavailable: inactive lookalike checking,
 *   domain-age-unavailable notes, unfinished required checks. None of these is
 *   presented as a passed check.
 *
 * All finding text is untrusted: it is rendered as plain React text after
 * defangText (the report's defanging), and URLs are never made clickable.
 */
export const VERIFIED_CHECKS_HEADING = "Verified Checks";
export const VERIFIED_CHECKS_SUBTITLE = "Rule-based checks — not AI";
export const FINDINGS_HEADING = "Findings";
export const INFORMATIONAL_HEADING = "Informational context";
export const NOT_PERFORMED_HEADING = "Checks not performed / unavailable";
export const NO_SCORED_FINDINGS_NOTICE =
  "No scored deterministic findings were produced. This is not proof that the message is safe.";
export const PARTIAL_FINDINGS_NOTICE =
  "The deterministic checks did not complete. Findings below were collected before the interruption.";

function FindingItem({ finding, showWeight }: { finding: DeterministicFinding; showWeight: boolean }) {
  const checkType = knownCheckLabel(finding.check) ?? defangText(finding.check);
  return (
    <li data-finding={finding.category} className="rounded border border-dark-ink/20 bg-white/60 p-3">
      <p className="font-semibold">{defangText(finding.label)}</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-medium">Check</dt>
        <dd>{checkType}</dd>
        {finding.url ? (
          <>
            <dt className="font-medium">URL</dt>
            <dd data-url="" className="break-all font-mono">
              {defangText(finding.url)}
            </dd>
          </>
        ) : null}
        <dt className="font-medium">Outcome</dt>
        <dd>{defangText(finding.evidence)}</dd>
        {finding.matchedText ? (
          <>
            <dt className="font-medium">Matched text</dt>
            <dd>“{defangText(finding.matchedText)}”</dd>
          </>
        ) : null}
        {finding.suspectedLegitDomain ? (
          <>
            <dt className="font-medium">Resembles</dt>
            <dd className="break-all font-mono">{defangText(finding.suspectedLegitDomain)}</dd>
          </>
        ) : null}
        {finding.needsManualVerification ? (
          <>
            <dt className="font-medium">Note</dt>
            <dd>Needs manual verification</dd>
          </>
        ) : null}
        {finding.reference ? (
          <>
            <dt className="font-medium">Reference</dt>
            <dd>{defangText(finding.reference)}</dd>
          </>
        ) : null}
        {showWeight ? (
          <>
            <dt className="font-medium">Score contribution</dt>
            <dd data-weight="">+{finding.weight}</dd>
          </>
        ) : null}
      </dl>
    </li>
  );
}

export function VerifiedChecks({ result }: { result: ScanResult }) {
  const id = useId();
  const headingId = `${id}-heading`;
  const complete = result.deterministicStatus === "complete";
  const { scored, informational, ageNotes } = partitionDeterministicFindings(
    result.deterministicFindings,
  );
  const unfinished = complete ? [] : result.incompleteChecks;
  const notPerformedCount =
    (result.lookalikeCheckActive ? 0 : 1) + ageNotes.length + unfinished.length + (complete ? 0 : 1);

  return (
    <section aria-labelledby={headingId} data-section="verified-checks" className="flex flex-col gap-4">
      <header>
        <h2 id={headingId} className="text-xl font-bold">
          {VERIFIED_CHECKS_HEADING}
        </h2>
        <p className="text-sm font-medium">{VERIFIED_CHECKS_SUBTITLE}</p>
      </header>

      {!complete ? (
        <p data-partial="" className="rounded border border-dark-ink/30 p-3 text-sm">
          {PARTIAL_FINDINGS_NOTICE}
        </p>
      ) : null}

      <div data-subarea="findings">
        <h3 className="font-semibold">{FINDINGS_HEADING}</h3>
        {scored.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {scored.map((f) => (
              <FindingItem key={f.id} finding={f} showWeight />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm">{NO_SCORED_FINDINGS_NOTICE}</p>
        )}
      </div>

      <div data-subarea="informational">
        <h3 className="font-semibold">{INFORMATIONAL_HEADING}</h3>
        {informational.length ? (
          <>
            <p className="mt-1 text-sm">{INFORMATIONAL_CONTEXT_NOTICE}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {informational.map((f) => (
                <FindingItem key={f.id} finding={f} showWeight={false} />
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm">None.</p>
        )}
      </div>

      <div data-subarea="not-performed">
        <h3 className="font-semibold">{NOT_PERFORMED_HEADING}</h3>
        {notPerformedCount ? (
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {!result.lookalikeCheckActive ? <li>{LOOKALIKE_INACTIVE_NOTICE}</li> : null}
            {ageNotes.map((f) => (
              <li key={f.id} data-finding={f.category}>
                {defangText(f.label)}: {defangText(f.evidence)}
              </li>
            ))}
            {unfinished.map((c) => (
              <li key={c} data-unfinished={c}>
                {unfinishedCheckNotice(knownCheckLabel(c) ?? defangText(c))}
              </li>
            ))}
            {!complete ? <li>{DOMAIN_AGE_SKIPPED_NOTICE}</li> : null}
          </ul>
        ) : (
          <p className="mt-1 text-sm">None reported.</p>
        )}
      </div>
    </section>
  );
}
