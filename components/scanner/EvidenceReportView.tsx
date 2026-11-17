import { useId, useMemo } from "react";
import { buildEvidenceReport } from "@/lib/report/evidenceReport";
import type { ScanResult } from "@/lib/types";
import { EvidenceReportExport } from "./EvidenceReportExport";

/**
 * "Evidence, preserved." view: the exact Evidence_Report text produced by
 * buildEvidenceReport for this scan result (the same text that Copy and
 * Download export), shown as plain, scrollable text. Copy and Download are
 * the real EvidenceReportExport controls: they write to the clipboard and
 * create a file in the browser. Nothing is stored by Scryvorn.
 */
export const EVIDENCE_REPORT_HEADING = "Evidence report";

export function EvidenceReportView({ result }: { result: ScanResult }) {
  const headingId = `${useId()}-heading`;
  const text = useMemo(() => {
    try {
      return buildEvidenceReport(result);
    } catch {
      return null;
    }
  }, [result]);

  return (
    <section aria-labelledby={headingId} data-section="evidence-report" className="flex min-w-0 flex-col gap-4">
      <h2 id={headingId} className="font-serif text-2xl font-semibold text-scry-ivory sm:text-3xl">
        {EVIDENCE_REPORT_HEADING}
      </h2>
      {text !== null ? (
        <pre
          data-report-text=""
          tabIndex={0}
          aria-label="Evidence report text"
          className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-sm border border-scry-border bg-scry-bg/80 p-4 font-mono text-[0.8125rem] leading-relaxed text-scry-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber"
        >
          {text}
        </pre>
      ) : null}
      <EvidenceReportExport result={result} />
    </section>
  );
}
