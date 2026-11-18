import type { ReportLine, Span } from "./reportDocument";

/**
 * Minimal, dependency-free PDF 1.4 writer for the Evidence Report.
 *
 * - A4 pages, the standard Helvetica and Helvetica-Bold fonts (built into
 *   every PDF viewer, so nothing is embedded), WinAnsi encoding.
 * - Word wrapping uses the Helvetica character widths; long words are split.
 * - Each page has a footer with the report title and "Page n of m".
 * - Text that WinAnsi cannot represent (for example non-Latin scripts or
 *   emoji) is shown as "?". This is never silent: the PDF then states that
 *   some characters could not be shown and that the .txt report has the exact
 *   text, and the result reports `substituted: true`.
 *
 * Text is inert: it is written as escaped PDF string literals, never as
 * links, actions, or scripts.
 */

export const PDF_SUBSTITUTION_NOTICE =
  'Some characters in this report could not be shown in the PDF and appear as "?". The plain-text (.txt) report contains the exact text.';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const SIZE = { title: 18, heading: 12, body: 10, footer: 8 } as const;
const LEADING = { title: 24, heading: 16, body: 14 } as const;

/** Helvetica advance widths (1/1000 em) for U+0020..U+007E. */
const HELVETICA_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
/** Helvetica-Bold is wider; a uniform factor is accurate enough for wrapping with slack. */
const BOLD_FACTOR = 1.08;

/** WinAnsi (CP1252) code points 0x80-0x9F that differ from Latin-1. */
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/** Encodes text to WinAnsi bytes (as a Latin-1 string). Unrepresentable characters become "?". */
export function toWinAnsi(text: string): { bytes: string; lost: boolean } {
  let bytes = "";
  let lost = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) bytes += ch;
    else if (WIN_ANSI_EXTRA[ch] !== undefined) bytes += String.fromCharCode(WIN_ANSI_EXTRA[ch]);
    else {
      bytes += "?";
      lost = true;
    }
  }
  return { bytes, lost };
}

/** Width in points of WinAnsi-encoded text. */
function width(bytes: string, size: number, bold: boolean): number {
  let w = 0;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes.charCodeAt(i);
    w += c >= 0x20 && c <= 0x7e ? HELVETICA_ASCII[c - 0x20] : 556;
  }
  return ((w * size) / 1000) * (bold ? BOLD_FACTOR : 1);
}

const escapePdfString = (bytes: string) => bytes.replace(/[\\()]/g, "\\$&");

type Run = { bytes: string; bold: boolean };

/** Splits encoded spans into words (keeping trailing spaces) and wraps them to maxWidth. */
function wrap(runs: Run[], size: number, maxWidth: number): Run[][] {
  const words: Run[] = [];
  for (const r of runs) for (const part of r.bytes.match(/\S+\s*|\s+/g) ?? []) words.push({ bytes: part, bold: r.bold });
  const lines: Run[][] = [];
  let line: Run[] = [];
  let used = 0;
  const push = () => {
    if (line.length) {
      // Merge adjacent words of the same weight into one text run per line.
      const merged: Run[] = [];
      for (const r of line) {
        const last = merged[merged.length - 1];
        if (last && last.bold === r.bold) last.bytes += r.bytes;
        else merged.push({ ...r });
      }
      lines.push(merged);
    }
    line = [];
    used = 0;
  };
  for (const word of words) {
    const w = width(word.bytes.trimEnd(), size, word.bold);
    if (used > 0 && used + w > maxWidth) push();
    if (w > maxWidth) {
      // A single word longer than the line (for example a long defanged URL): split it.
      let rest = word.bytes;
      while (width(rest.trimEnd(), size, word.bold) > maxWidth) {
        let n = rest.length;
        while (n > 1 && width(rest.slice(0, n), size, word.bold) > maxWidth) n--;
        line.push({ bytes: rest.slice(0, n), bold: word.bold });
        push();
        rest = rest.slice(n);
      }
      line.push({ bytes: rest, bold: word.bold });
      used = width(rest, size, word.bold);
      continue;
    }
    line.push(word);
    used += width(word.bytes, size, word.bold);
  }
  push();
  return lines.length ? lines : [[]];
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" ");
};
const INK = rgb("#1A1614");
const MUTED = rgb("#6B625A");
const CRIMSON = rgb("#9B2626");
const f = (n: number) => n.toFixed(2);

export interface PdfOptions {
  /** Document title (also used in the footer and PDF metadata). */
  title: string;
}

export interface PdfOutput {
  /** The PDF file bytes (a plain ArrayBuffer, so it can be passed to Blob). */
  bytes: Uint8Array<ArrayBuffer>;
  pageCount: number;
  /** True if any character had to be shown as "?" (the PDF says so). */
  substituted: boolean;
}

export function buildReportPdf(lines: readonly ReportLine[], { title }: PdfOptions): PdfOutput {
  const encode = (spans: readonly Span[]) => spans.map((s) => ({ ...toWinAnsi(s.text), bold: s.bold }));
  const encoded = lines.map((l) => (l.kind === "blank" ? null : encode(l.spans)));
  const substituted = encoded.some((runs) => runs?.some((r) => r.lost) ?? false) || toWinAnsi(title).lost;

  const pages: string[][] = [[]];
  let y = PAGE_H - MARGIN_TOP;
  const ops = () => pages[pages.length - 1];
  const ensure = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      pages.push([]);
      y = PAGE_H - MARGIN_TOP;
    }
  };
  const textLine = (runs: Run[], x: number, size: number, color: string) => {
    let s = `BT ${color} rg ${f(x)} ${f(y)} Td`;
    let font = "";
    for (const r of runs) {
      const want = r.bold ? "/F2" : "/F1";
      if (want !== font) {
        s += ` ${want} ${size} Tf`;
        font = want;
      }
      s += ` (${escapePdfString(r.bytes)}) Tj`;
    }
    ops().push(`${s} ET`);
  };
  const rule = (thickness: number, color: string) =>
    ops().push(`${color} RG ${f(thickness)} w ${f(MARGIN_X)} ${f(y)} m ${f(PAGE_W - MARGIN_X)} ${f(y)} l S`);

  /** Writes wrapped runs with a hanging indent; the marker (if any) sits at markerX on the first line. */
  const block = (runs: Run[], textX: number, size: number, leading: number, color: string, marker?: { x: number; bytes: string }) => {
    const wrapped = wrap(runs, size, PAGE_W - MARGIN_X - textX);
    wrapped.forEach((lineRuns, i) => {
      ensure(leading);
      y -= leading;
      if (i === 0 && marker) textLine([{ bytes: marker.bytes, bold: false }], marker.x, size, color);
      textLine(lineRuns, textX, size, color);
    });
  };

  if (substituted) {
    // Stated up front so the reader knows before relying on the PDF text.
    block([{ bytes: toWinAnsi(PDF_SUBSTITUTION_NOTICE).bytes, bold: true }], MARGIN_X, SIZE.body, LEADING.body, CRIMSON);
    y -= 8;
  }

  lines.forEach((line, i) => {
    const runs = encoded[i];
    switch (line.kind) {
      case "blank":
        y -= LEADING.body * 0.5;
        break;
      case "title":
        block(runs!, MARGIN_X, SIZE.title, LEADING.title, CRIMSON);
        y -= 8;
        rule(1.2, CRIMSON);
        y -= 6;
        break;
      case "heading":
        ensure(LEADING.heading + LEADING.body * 2 + 14); // keep a heading with its first lines
        y -= 10;
        block(runs!, MARGIN_X, SIZE.heading, LEADING.heading, CRIMSON);
        y -= 5;
        rule(0.5, MUTED);
        y -= 2;
        break;
      case "bullet": {
        const markerX = MARGIN_X + (line.level === 0 ? 4 : 22);
        block(runs!, markerX + 12, SIZE.body, LEADING.body, INK, { x: markerX, bytes: line.level === 0 ? "\x95" : "\x96" });
        break;
      }
      case "numbered":
        block(runs!, MARGIN_X + 22, SIZE.body, LEADING.body, INK, { x: MARGIN_X + 4, bytes: line.marker });
        break;
      case "text":
        block(runs!, MARGIN_X, SIZE.body, LEADING.body, INK);
        break;
    }
  });

  // Footers (now that the page count is known).
  const titleBytes = toWinAnsi(title).bytes;
  pages.forEach((page, i) => {
    const footer = `${titleBytes}  \x95  Page ${i + 1} of ${pages.length}`;
    page.push(`${MUTED} RG 0.4 w ${f(MARGIN_X)} ${f(MARGIN_BOTTOM - 22)} m ${f(PAGE_W - MARGIN_X)} ${f(MARGIN_BOTTOM - 22)} l S`);
    page.push(`BT ${MUTED} rg /F1 ${SIZE.footer} Tf ${f(MARGIN_X)} ${f(MARGIN_BOTTOM - 36)} Td (${escapePdfString(footer)}) Tj ET`);
  });

  // Serialize. Every character is a single byte (Latin-1), so string length = byte length.
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 6 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = `<< /Title (${escapePdfString(titleBytes)}) /Producer (SCRYVORN) >>`;
  pages.forEach((page, i) => {
    const content = page.join("\n");
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(new ArrayBuffer(out.length));
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return { bytes, pageCount: pages.length, substituted };
}

/** Title used in the PDF footer and metadata. */
export const REPORT_PDF_TITLE = "SCRYVORN Evidence Report";
