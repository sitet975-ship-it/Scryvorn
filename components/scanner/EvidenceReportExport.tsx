"use client";

import { useMemo, useState } from "react";
import type { ScanResult } from "@/lib/types";
import { buildEvidenceReport, reportFilename } from "@/lib/report/evidenceReport";

/**
 * Copy / download the Evidence_Report built by buildEvidenceReport.
 *
 * - Both buttons are disabled until a scan result exists (result === null).
 * - Copy uses navigator.clipboard.writeText. Download creates a Markdown Blob,
 *   an object URL, and a temporary <a download> with reportFilename (UTC).
 * - On failure an error notice is shown; the report is derived from the same
 *   result, so it is unchanged and the user can retry.
 * - Status messages are announced through an always-present aria-live region
 *   and apply only to the report they were produced for.
 *
 * Testing limit: jsdom tests mock navigator.clipboard and URL.createObjectURL.
 * They cannot verify a real system clipboard write or a real browser download.
 */
export const COPY_LABEL = "Copy Evidence Report";
export const DOWNLOAD_LABEL = "Download Report (.md)";
export const COPY_SUCCESS = "Evidence report copied to clipboard.";
export const COPY_FAILURE =
  "Could not copy the evidence report. The report is unchanged; please try again.";
export const DOWNLOAD_FAILURE =
  "Could not download the evidence report. The report is unchanged; please try again.";
export const BUILD_FAILURE = "The evidence report could not be generated for this scan.";
export const downloadStarted = (filename: string) => `Download started: ${filename}`;

type Status = { kind: "success" | "error"; text: string; report: string } | null;

function build(result: ScanResult | null): { report: string; filename: string } | null | "error" {
  if (!result) return null;
  try {
    return { report: buildEvidenceReport(result), filename: reportFilename(result.timestamp) };
  } catch {
    return "error";
  }
}

const BUTTON_CLASS =
  "inline-flex min-h-[48px] items-center justify-center rounded-sm border border-scry-amber/60 bg-scry-bg/70 px-5 py-2 font-semibold text-scry-ivory transition hover:border-scry-amber hover:bg-scry-crimson/30 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber";

export function EvidenceReportExport({ result }: { result: ScanResult | null }) {
  const built = useMemo(() => build(result), [result]);
  const [status, setStatus] = useState<Status>(null);
  const ready = built !== null && built !== "error";
  const report = ready ? built.report : null;

  async function copy() {
    if (!ready) return;
    const text = built.report;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus({ kind: "success", text: COPY_SUCCESS, report: text });
    } catch {
      setStatus({ kind: "error", text: COPY_FAILURE, report: text });
    }
  }

  function download() {
    if (!ready) return;
    const { report: text, filename } = built;
    let url: string | null = null;
    try {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({ kind: "success", text: downloadStarted(filename), report: text });
    } catch {
      setStatus({ kind: "error", text: DOWNLOAD_FAILURE, report: text });
    } finally {
      if (url) {
        const toRevoke = url;
        // Revoke after the click has been handled.
        setTimeout(() => URL.revokeObjectURL(toRevoke), 0);
      }
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
        <button type="button" onClick={download} disabled={!ready} className={BUTTON_CLASS}>
          {DOWNLOAD_LABEL}
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
