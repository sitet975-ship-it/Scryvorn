import type { ScanResult } from "@/lib/types";
import { buildEvidenceReport, reportFilename } from "./evidenceReport";

/**
 * The Evidence Report as a structured document, for display and for the
 * plain-text (.txt) and PDF exports.
 *
 * Single source of truth: the document is derived line by line from
 * buildEvidenceReport (the reviewed Markdown report), so the wording, order,
 * and defanging are identical in every format. Only the Markdown syntax is
 * removed: heading markers (#), list markers, bold markers (**), and the
 * backslash escapes added by toSafeMarkdownText. Untrusted values stay
 * defanged (hxxps://, [.]) because that happens before escaping.
 */

export interface Span {
  text: string;
  bold: boolean;
}

export type ReportLine =
  | { kind: "title"; spans: Span[] }
  | { kind: "heading"; spans: Span[] }
  | { kind: "bullet"; level: 0 | 1; spans: Span[] }
  | { kind: "numbered"; marker: string; spans: Span[] }
  | { kind: "text"; spans: Span[] }
  | { kind: "blank" };

/** Removes Markdown escapes and bold markers, keeping which runs were bold. */
export function parseInline(md: string): Span[] {
  const spans: Span[] = [];
  let bold = false;
  let buf = "";
  const flush = () => {
    if (buf) spans.push({ text: buf, bold });
    buf = "";
  };
  for (let i = 0; i < md.length; i++) {
    const c = md[i];
    if (c === "\\" && i + 1 < md.length) {
      buf += md[++i];
    } else if (c === "*" && md[i + 1] === "*") {
      flush();
      bold = !bold;
      i++;
    } else {
      buf += c;
    }
  }
  flush();
  return spans;
}

export function spansText(spans: readonly Span[]): string {
  return spans.map((s) => s.text).join("");
}

/** Converts the report's Markdown (as produced by buildEvidenceReport) into structured lines. */
export function markdownToReportLines(markdown: string): ReportLine[] {
  const lines: ReportLine[] = [];
  for (const raw of markdown.split("\n")) {
    let m: RegExpExecArray | null;
    if (raw.trim() === "") {
      if (lines.length && lines[lines.length - 1].kind !== "blank") lines.push({ kind: "blank" });
    } else if ((m = /^# (.*)$/.exec(raw))) {
      lines.push({ kind: "title", spans: parseInline(m[1]) });
    } else if ((m = /^## (.*)$/.exec(raw))) {
      lines.push({ kind: "heading", spans: parseInline(m[1]) });
    } else if ((m = /^( *)- (.*)$/.exec(raw))) {
      lines.push({ kind: "bullet", level: m[1].length >= 2 ? 1 : 0, spans: parseInline(m[2]) });
    } else if ((m = /^(\d+)\. (.*)$/.exec(raw))) {
      lines.push({ kind: "numbered", marker: `${m[1]}.`, spans: parseInline(m[2]) });
    } else {
      lines.push({ kind: "text", spans: parseInline(raw) });
    }
  }
  while (lines.length && lines[lines.length - 1].kind === "blank") lines.pop();
  return lines;
}

/** The Evidence Report as structured lines. Throws InvalidTimestampError like buildEvidenceReport. */
export function buildReportDocument(result: ScanResult): ReportLine[] {
  return markdownToReportLines(buildEvidenceReport(result));
}

/** Renders structured lines as clean plain text (no Markdown symbols). */
export function renderPlainText(lines: readonly ReportLine[]): string {
  const out: string[] = [];
  for (const line of lines) {
    switch (line.kind) {
      case "title": {
        const t = spansText(line.spans).toUpperCase();
        out.push(t, "=".repeat(t.length));
        break;
      }
      case "heading": {
        const t = spansText(line.spans);
        out.push(t, "-".repeat(t.length));
        break;
      }
      case "bullet":
        out.push(`${line.level === 0 ? "  • " : "      – "}${spansText(line.spans)}`);
        break;
      case "numbered":
        out.push(`  ${line.marker} ${spansText(line.spans)}`);
        break;
      case "text":
        out.push(spansText(line.spans));
        break;
      case "blank":
        out.push("");
        break;
    }
  }
  return out.join("\n") + "\n";
}

/** The plain-text Evidence Report (used for Copy, the .txt download, and Saved Investigations). */
export function buildPlainTextReport(result: ScanResult): string {
  return renderPlainText(buildReportDocument(result));
}

/** `scryvorn-report-YYYYMMDD-HHmmss.<ext>` in UTC. Throws InvalidTimestampError. */
export function reportFilenameWithExtension(timestamp: string, ext: "txt" | "pdf"): string {
  return reportFilename(timestamp).replace(/\.md$/, `.${ext}`);
}
