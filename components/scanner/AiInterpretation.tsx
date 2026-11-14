import { useId } from "react";
import type { ScanResult } from "@/lib/types";
import {
  AI_FINDINGS_ARE_INTERPRETATION_NOTICE,
  AI_NO_FINDINGS_NOTICE,
  aiUnavailableNotice,
} from "@/lib/report/evidenceReport";
import { defangText } from "@/lib/report/safeMarkdown";

/**
 * AI-generated interpretation only. Deterministic findings are never rendered here.
 *
 * States: unavailable (timeout / error or unusable response), available with
 * no findings, available with findings. When AI is unavailable, no AI findings
 * are rendered even if the result object carries some. Findings are labelled as
 * model interpretation with the model's confidence, never as verified facts.
 * All AI text is untrusted: plain React text after defangText; no links.
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
      <p data-ai-state="unavailable" className="rounded border border-dark-ink/30 p-3 text-sm font-medium">
        {aiUnavailableNotice(result.aiUnavailableReason)}
      </p>
    );
  } else if (result.aiFindings.length === 0) {
    body = (
      <p data-ai-state="no-findings" className="text-sm">
        {AI_NO_FINDINGS_NOTICE}
      </p>
    );
  } else {
    body = (
      <div data-ai-state="findings">
        <p className="text-sm">{AI_FINDINGS_ARE_INTERPRETATION_NOTICE}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {result.aiFindings.map((f) => (
            <li key={f.id} data-ai-finding="" className="rounded border border-dark-ink/20 bg-white/60 p-3">
              <p className="font-semibold">{defangText(f.label)}</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-medium">Type</dt>
                <dd>Model interpretation</dd>
                <dt className="font-medium">Model confidence</dt>
                <dd data-confidence="">{CONFIDENCE_LABEL[f.severity] ?? defangText(f.severity)}</dd>
                <dt className="font-medium">Category</dt>
                <dd>{defangText(f.category)}</dd>
                <dt className="font-medium">Evidence cited</dt>
                <dd>{defangText(f.evidence)}</dd>
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
        <h2 id={headingId} className="text-xl font-bold">
          {AI_HEADING}
        </h2>
        <p className="text-sm font-medium">{AI_SUBTITLE}</p>
      </header>
      {result.aiAvailable && result.deterministicStatus === "incomplete" ? (
        <p data-ai-partial="" className="rounded border border-dark-ink/30 p-3 text-sm">
          {AI_PARTIAL_EVIDENCE_NOTICE}
        </p>
      ) : null}
      {body}
    </section>
  );
}
