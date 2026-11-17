import { useId } from "react";
import type { ScanResult } from "@/lib/types";
import {
  AI_FINDINGS_ARE_INTERPRETATION_NOTICE,
  AI_NO_FINDINGS_NOTICE,
  aiUnavailableNotice,
} from "@/lib/report/evidenceReport";
import { defangText } from "@/lib/report/safeMarkdown";
import { DT, SourceBadge } from "./EvidenceCard";

/**
 * AI-generated interpretation only. Deterministic findings are never rendered here.
 *
 * States: unavailable (timeout / error or unusable response), available with
 * no findings, available with findings. When AI is unavailable, no AI findings
 * are rendered even if the result object carries some. Findings are labelled as
 * model interpretation with the model's confidence, never as verified facts.
 * All AI text is untrusted: plain React text after defangText; no links.
 * Laboratory green marks this layer; text stays ivory for readability.
 */
export const AI_HEADING = "AI Interpretation";
export const AI_SUBTITLE = "Model-generated interpretation — not verified fact";
export const AI_PARTIAL_EVIDENCE_NOTICE =
  "AI analysis used partial deterministic evidence because the deterministic checks did not complete.";

const CONFIDENCE_LABEL = { low: "Low", medium: "Medium", high: "High" } as const;

export function AiInterpretation({ result }: { result: ScanResult }) {
  const id = useId();
  const headingId = `${id}-heading`;

  let body;
  if (!result.aiAvailable) {
    body = (
      <p
        data-ai-state="unavailable"
        className="rounded-sm border-2 border-dashed border-scry-green-deep/70 p-3 text-sm font-semibold text-scry-ivory"
      >
        {aiUnavailableNotice(result.aiUnavailableReason)}
      </p>
    );
  } else if (result.aiFindings.length === 0) {
    body = (
      <p data-ai-state="no-findings" className="text-sm text-scry-ivory">
        {AI_NO_FINDINGS_NOTICE}
      </p>
    );
  } else {
    body = (
      <div data-ai-state="findings">
        <p className="text-sm text-scry-muted">{AI_FINDINGS_ARE_INTERPRETATION_NOTICE}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {result.aiFindings.map((f) => (
            <li
              key={f.id}
              data-ai-finding=""
              className="rounded-sm border border-scry-green-deep/50 border-l-[3px] border-l-scry-green bg-scry-bg/60 p-4"
            >
              <SourceBadge source="ai_interpretation" />
              <p className="mt-2 font-serif text-lg font-semibold leading-snug text-scry-ivory">{defangText(f.label)}</p>
              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className={DT}>Type</dt>
                <dd className="text-scry-ivory">Model interpretation</dd>
                <dt className={DT}>Model confidence</dt>
                <dd data-confidence="" className="text-scry-ivory">
                  {CONFIDENCE_LABEL[f.severity] ?? defangText(f.severity)}
                </dd>
                <dt className={DT}>Category</dt>
                <dd className="text-scry-ivory">{defangText(f.category)}</dd>
                <dt className={DT}>Evidence cited</dt>
                <dd className="text-scry-ivory">{defangText(f.evidence)}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId} data-section="ai-interpretation" className="flex flex-col gap-3">
      <header>
        <h2 id={headingId} className="font-serif text-2xl font-semibold text-scry-ivory sm:text-3xl">
          {AI_HEADING}
        </h2>
        <p className="mt-1 text-sm font-medium text-scry-green">{AI_SUBTITLE}</p>
      </header>
      {result.aiAvailable && result.deterministicStatus === "incomplete" ? (
        <p data-ai-partial="" className="rounded-sm border-2 border-dashed border-scry-ivory/40 p-3 text-sm text-scry-ivory">
          {AI_PARTIAL_EVIDENCE_NOTICE}
        </p>
      ) : null}
      {body}
    </section>
  );
}
