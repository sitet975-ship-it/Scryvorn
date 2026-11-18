import { Fragment, useId, useMemo, type ReactNode } from "react";
import { buildReportDocument, type ReportLine, type Span } from "@/lib/report/reportDocument";
import type { ScanResult } from "@/lib/types";
import { EvidenceReportExport } from "./EvidenceReportExport";

/**
 * "Evidence, preserved." view: the Evidence Report for this scan result,
 * shown as a formatted document (real headings and lists, no Markdown
 * symbols). It has the same wording as the Copy, PDF, and .txt exports, which
 * come from the same report document. Untrusted values are rendered as React
 * text, already defanged, and never as links. Nothing is uploaded.
 */
export const EVIDENCE_REPORT_HEADING = "Evidence report";

function Spans({ spans }: { spans: readonly Span[] }) {
  return (
    <>
      {spans.map((s, i) => (s.bold ? <strong key={i} className="font-semibold text-scry-ivory">{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>))}
    </>
  );
}

type Bullet = Extract<ReportLine, { kind: "bullet" }>;
type Numbered = Extract<ReportLine, { kind: "numbered" }>;

/** Groups consecutive list lines so they render as real (nested) lists. */
function renderLines(lines: readonly ReportLine[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "bullet") {
      const items: { top: Bullet; subs: Bullet[] }[] = [];
      while (i < lines.length && lines[i].kind === "bullet") {
        const b = lines[i] as Bullet;
        if (b.level === 1 && items.length) items[items.length - 1].subs.push(b);
        else items.push({ top: b, subs: [] });
        i++;
      }
      out.push(
        <ul key={`ul-${i}`} className="ml-5 list-disc space-y-1 marker:text-scry-amber">
          {items.map((it, k) => (
            <li key={k}>
              <Spans spans={it.top.spans} />
              {it.subs.length ? (
                <ul className="ml-5 mt-1 list-[circle] space-y-0.5 text-scry-muted">
                  {it.subs.map((s, j) => (
                    <li key={j}>
                      <Spans spans={s.spans} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.kind === "numbered") {
      const items: Numbered[] = [];
      while (i < lines.length && lines[i].kind === "numbered") items.push(lines[i++] as Numbered);
      out.push(
        <ol key={`ol-${i}`} className="ml-5 list-decimal space-y-1 marker:text-scry-amber">
          {items.map((it, k) => (
            <li key={k}>
              <Spans spans={it.spans} />
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    if (line.kind === "title") {
      out.push(
        <p key={i} data-report-title="" className="text-xs font-semibold uppercase tracking-[0.22em] text-scry-amber">
          <Spans spans={line.spans} />
        </p>,
      );
    } else if (line.kind === "heading") {
      out.push(
        <h3 key={i} className="mt-4 border-b border-scry-border pb-1 font-serif text-lg font-semibold text-scry-ivory">
          <Spans spans={line.spans} />
        </h3>,
      );
    } else if (line.kind === "text") {
      out.push(
        <p key={i}>
          <Spans spans={line.spans} />
        </p>,
      );
    }
    i++;
  }
  return out;
}

export function EvidenceReportView({ result }: { result: ScanResult }) {
  const headingId = `${useId()}-heading`;
  const lines = useMemo(() => {
    try {
      return buildReportDocument(result);
    } catch {
      return null;
    }
  }, [result]);

  return (
    <section aria-labelledby={headingId} data-section="evidence-report" className="flex min-w-0 flex-col gap-4">
      <h2 id={headingId} className="font-serif text-2xl font-semibold text-scry-ivory sm:text-3xl">
        {EVIDENCE_REPORT_HEADING}
      </h2>
      {lines !== null ? (
        <div
          data-report-text=""
          tabIndex={0}
          role="region"
          aria-label="Evidence report text"
          className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto break-words rounded-sm border border-scry-border bg-scry-bg/80 p-4 text-sm leading-relaxed text-scry-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber sm:p-5"
        >
          {renderLines(lines)}
        </div>
      ) : null}
      <EvidenceReportExport result={result} />
    </section>
  );
}
