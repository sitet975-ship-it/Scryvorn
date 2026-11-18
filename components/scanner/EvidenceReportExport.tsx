"use client";

import { useMemo, useState } from "react";
import type { ScanResult } from "@/lib/types";
import { REPORT_PDF_TITLE, buildReportPdf } from "@/lib/report/pdf";
import { buildReportDocument, renderPlainText, reportFilenameWithExtension } from "@/lib/report/reportDocument";

/**
 * Copy / download the Evidence Report.
 *
 * - Copy writes the plain-text report (no Markdown symbols) with
 *   navigator.clipboard.writeText.
 * - Download PDF builds a real PDF file (lib/report/pdf, no dependencies).
 *   If some characters cannot be represented in the PDF, the PDF says so and
 *   the status message points to the exact .txt report. No format is ever
 *   substituted silently.
 * - Download .txt saves the same plain-text report.
 * - Files are named scryvorn-report-YYYYMMDD-HHmmss.<pdf|txt> (UTC) and are
 *   created in the browser from a Blob; nothing is uploaded or stored.
 * - All buttons are disabled until a scan result exists (result === null).
 * - On failure an error notice is shown; the report is derived from the same
 *   result, so it is unchanged and the user can retry.
 * - Status messages are announced through an always-present aria-live region
 *   and apply only to the report they were produced for.
 *
 * Testing limit: jsdom tests mock navigator.clipboard and URL.createObjectURL.
 * They cannot verify a real system clipboard write or a real browser download.
 */
export const COPY_LABEL = "Copy Evidence Report";
export const DOWNLOAD_PDF_LABEL = "Download Report (PDF)";
export const DOWNLOAD_TXT_LABEL = "Download Report (.txt)";
export const COPY_SUCCESS = "Evidence report copied to clipboard.";
export const COPY_FAILURE =
  "Could not copy the evidence report. The report is unchanged; please try again.";
export const DOWNLOAD_FAILURE =
  "Could not download the evidence report. The report is unchanged; please try again.";
export const BUILD_FAILURE = "The evidence report could not be generated for this scan.";
export const downloadStarted = (filename: string) => `Download started: ${filename}`;
export const PDF_SUBSTITUTION_STATUS =
  'Some characters could not be shown in the PDF and appear as "?". The .txt report contains the exact text.';

type Status = { kind: "success" | "error"; text: string; report: string } | null;
type Built = { text: string; lines: ReturnType<typeof buildReportDocument>; timestamp: string };

function build(result: ScanResult | null): Built | null | "error" {
  if (!result) return null;
  try {
    const lines = buildReportDocument(result);
    reportFilenameWithExtension(result.timestamp, "txt"); // validates the timestamp
    return { text: renderPlainText(lines), lines, timestamp: result.timestamp };
  } catch {
    return "error";
  }
}

const BUTTON_CLASS =
  "inline-flex min-h-[48px] items-center justify-center rounded-sm border border-scry-amber/60 bg-scry-bg/70 px-5 py-2 font-semibold text-scry-ivory transition hover:border-scry-amber hover:bg-scry-crimson/30 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber";

/** Saves a Blob through a temporary <a download>, so the browser downloads it as a file. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke after the click has been handled.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function EvidenceReportExport({ result }: { result: ScanResult | null }) {
  const built = useMemo(() => build(result), [result]);
  const [status, setStatus] = useState<Status>(null);
  const ready = built !== null && built !== "error";
  const report = ready ? built.text : null;

  async function copy() {
    if (!ready) return;
    const text = built.text;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus({ kind: "success", text: COPY_SUCCESS, report: text });
    } catch {
      setStatus({ kind: "error", text: COPY_FAILURE, report: text });
    }
  }

  function downloadPdf() {
    if (!ready) return;
    try {
      const filename = reportFilenameWithExtension(built.timestamp, "pdf");
      const pdf = buildReportPdf(built.lines, { title: REPORT_PDF_TITLE });
      saveBlob(new Blob([pdf.bytes], { type: "application/pdf" }), filename);
      const text = downloadStarted(filename) + (pdf.substituted ? ` ${PDF_SUBSTITUTION_STATUS}` : "");
      setStatus({ kind: "success", text, report: built.text });
    } catch {
      setStatus({ kind: "error", text: DOWNLOAD_FAILURE, report: built.text });
    }
  }

  function downloadTxt() {
    if (!ready) return;
    try {
      const filename = reportFilenameWithExtension(built.timestamp, "txt");
      saveBlob(new Blob([built.text], { type: "text/plain;charset=utf-8" }), filename);
      setStatus({ kind: "success", text: downloadStarted(filename), report: built.text });
    } catch {
      setStatus({ kind: "error", text: DOWNLOAD_FAILURE, report: built.text });
    }
  }

  const message =
    built === "error" ? BUILD_FAILURE : status && status.report === report ? status.text : "";
  const isError = built === "error" || (status?.kind === "error" && status.report === report);

  return (
    <div data-section="report-export" className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} disabled={!ready} className={BUTTON_CLASS}>
          {COPY_LABEL}
        </button>
        <button type="button" onClick={downloadPdf} disabled={!ready} className={BUTTON_CLASS}>
          {DOWNLOAD_PDF_LABEL}
        </button>
        <button type="button" onClick={downloadTxt} disabled={!ready} className={BUTTON_CLASS}>
          {DOWNLOAD_TXT_LABEL}
        </button>
      </div>
      <p
        aria-live="polite"
        data-export-status={message ? (isError ? "error" : "success") : ""}
        className={`min-h-5 text-sm font-semibold text-scry-ivory ${isError ? "border-l-4 border-scry-danger pl-2" : ""}`}
      >
        {message}
      </p>
    </div>
  );
}
