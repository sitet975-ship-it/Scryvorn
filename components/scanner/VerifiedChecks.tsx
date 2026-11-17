import { useId } from "react";
import type { ScanResult } from "@/lib/types";
import {
  DOMAIN_AGE_SKIPPED_NOTICE,
  INFORMATIONAL_CONTEXT_NOTICE,
  LOOKALIKE_INACTIVE_NOTICE,
  knownCheckLabel,
  partitionDeterministicFindings,
  unfinishedCheckNotice,
} from "@/lib/report/evidenceReport";
import { deterministicSource } from "@/lib/report/provenance";
import { defangText } from "@/lib/report/safeMarkdown";
import { EvidenceCard, SourceBadge } from "./EvidenceCard";

/**
 * Deterministic (rule-based) evidence only. AI findings are never rendered here.
 *
 * Sections (mirroring the Evidence_Report groups):
 * - Evidence found: scored findings (weight > 0), with score contribution.
 * - Context observed: weight-0 findings, without any score contribution.
 * - Checks not performed: inactive lookalike checking, domain-age-unavailable
 *   notes, unfinished required checks. None is presented as a passed check.
 *
 * Every item shows its provenance (message rules or link checks).
 * All finding text is untrusted: rendered as plain React text after
 * defangText, and URLs are never made clickable.
 */
export const VERIFIED_CHECKS_HEADING = "Verified Checks";
export const VERIFIED_CHECKS_SUBTITLE = "Rule-based checks — not AI";
export const FINDINGS_HEADING = "Evidence found";
export const INFORMATIONAL_HEADING = "Context observed";
export const NOT_PERFORMED_HEADING = "Checks not performed";
export const NO_SCORED_FINDINGS_NOTICE =
  "No scored deterministic findings were produced. This is not proof that the message is safe.";
export const PARTIAL_FINDINGS_NOTICE =
  "The deterministic checks did not complete. Findings below were collected before the interruption.";

const H3 = "font-serif text-xl font-semibold text-scry-ivory";

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
    <section aria-labelledby={headingId} data-section="verified-checks" className="flex flex-col gap-6">
      <header>
        <h2 id={headingId} className="font-serif text-2xl font-semibold text-scry-ivory sm:text-3xl">
          {VERIFIED_CHECKS_HEADING}
        </h2>
        <p className="mt-1 text-sm font-medium text-scry-amber">{VERIFIED_CHECKS_SUBTITLE}</p>
      </header>

      {!complete ? (
        <p data-partial="" className="rounded-sm border-2 border-dashed border-scry-ivory/40 p-3 text-sm font-medium text-scry-ivory">
          {PARTIAL_FINDINGS_NOTICE}
        </p>
      ) : null}

      <div data-subarea="findings">
        <h3 className={H3}>{FINDINGS_HEADING}</h3>
        {scored.length ? (
          <ul className="mt-3 flex flex-col gap-3">
            {scored.map((f) => (
              <EvidenceCard key={f.id} finding={f} scored />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-scry-ivory">{NO_SCORED_FINDINGS_NOTICE}</p>
        )}
      </div>

      <div data-subarea="informational">
        <h3 className={H3}>{INFORMATIONAL_HEADING}</h3>
        {informational.length ? (
          <>
            <p className="mt-2 text-sm text-scry-muted">{INFORMATIONAL_CONTEXT_NOTICE}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {informational.map((f) => (
                <EvidenceCard key={f.id} finding={f} scored={false} />
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-scry-ivory">None.</p>
        )}
      </div>

      <div data-subarea="not-performed" className="rounded-sm border border-dashed border-scry-amber/40 p-4">
        <h3 className={H3}>{NOT_PERFORMED_HEADING}</h3>
        {notPerformedCount ? (
          <ul className="mt-3 flex flex-col gap-3 text-sm text-scry-ivory">
            {!result.lookalikeCheckActive ? (
              <li className="flex flex-col gap-1">
                <span><SourceBadge source="link_checks" /></span>
                <span>{LOOKALIKE_INACTIVE_NOTICE}</span>
              </li>
            ) : null}
            {ageNotes.map((f) => (
              <li key={f.id} data-finding={f.category} className="flex flex-col gap-1">
                <span><SourceBadge source={deterministicSource(f.check)} /></span>
                <span>
                  {defangText(f.label)}: {defangText(f.evidence)}
                </span>
              </li>
            ))}
            {unfinished.map((c) => (
              <li key={c} data-unfinished={c} className="flex flex-col gap-1">
                <span><SourceBadge source={deterministicSource(c)} /></span>
                <span>{unfinishedCheckNotice(knownCheckLabel(c) ?? defangText(c))}</span>
              </li>
            ))}
            {!complete ? (
              <li className="flex flex-col gap-1">
                <span><SourceBadge source="link_checks" /></span>
                <span>{DOMAIN_AGE_SKIPPED_NOTICE}</span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-scry-ivory">None reported.</p>
        )}
      </div>
    </section>
  );
}
