import { useId } from "react";
import type { ScanResult } from "@/lib/types";
import {
  STEPS_ARE_RECOMMENDATIONS_NOTICE,
  STEP_SOURCE_LABELS,
  selectRecommendedSteps,
} from "@/lib/report/evidenceReport";
import { defangText } from "@/lib/report/safeMarkdown";

/**
 * Recommended verification steps, chosen by the same rule as the
 * Evidence_Report (selectRecommendedSteps): the reviewed fallback steps
 * whenever AI is unavailable or returned no steps. Step text is untrusted
 * (it may come from the model): plain React text after defangText, no links.
 */
export const RECOMMENDED_STEPS_HEADING = "Recommended verification steps";

export function RecommendedSteps({ result }: { result: ScanResult }) {
  const id = useId();
  const headingId = `${id}-heading`;
  const { steps, source } = selectRecommendedSteps(result);

  return (
    <section aria-labelledby={headingId} data-section="recommended-steps" className="flex flex-col gap-2">
      <h2 id={headingId} className="text-xl font-bold">
        {RECOMMENDED_STEPS_HEADING}
      </h2>
      <p className="text-sm">{STEPS_ARE_RECOMMENDATIONS_NOTICE}</p>
      <p data-step-source={source} className="text-sm font-medium">
        Source: {STEP_SOURCE_LABELS[source]}
      </p>
      <ol className="list-decimal pl-6 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="py-0.5">
            {defangText(step)}
          </li>
        ))}
      </ol>
    </section>
  );
}
