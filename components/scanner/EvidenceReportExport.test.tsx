/**
 * EvidenceReportExport tests.
 *
 * Limits: jsdom has no real system clipboard and performs no real download.
 * navigator.clipboard.writeText, URL.createObjectURL, URL.revokeObjectURL, and
 * anchor clicks are mocked or observed here. These tests verify the text
 * requested for the clipboard, the Blob contents and filename requested for the
 * download, the status messages, and retry behavior. They cannot verify that a
 * browser actually wrote to the clipboard or saved a file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { ADVISORY_DISCLAIMER, FALLBACK_VERIFICATION_STEPS } from "@/lib/constants";
import { buildPlainTextReport, reportFilenameWithExtension } from "@/lib/report/reportDocument";
import type { CompleteScanResult, IncompleteScanResult } from "@/lib/types";
import { render, type Rendered } from "@/test/dom";
import {
  BUILD_FAILURE,
  COPY_FAILURE,
  COPY_LABEL,
  COPY_SUCCESS,
  DOWNLOAD_FAILURE,
  DOWNLOAD_PDF_LABEL,
  DOWNLOAD_TXT_LABEL,
  EvidenceReportExport,
  PDF_SUBSTITUTION_STATUS,
  downloadStarted,
} from "./EvidenceReportExport";

const RESULT: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12+02:00",
  inputType: "url",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 15,
  severityTier: "Low risk — still verify independently",
  waxSealColor: "#059669",
  deterministicFindings: [
    {
      id: "shortener:1",
      source: "deterministic",
      check: "shortener",
      category: "shortener",
      label: "URL shortener",
      evidence: "Destination hidden",
      url: "https://short.example/abc",
      severity: "medium",
      weight: 15,
    },
  ],
  aiFindings: [],
  recommendedSteps: [...FALLBACK_VERIFICATION_STEPS],
  aiAvailable: false,
  aiUnavailableReason: "timeout",
  lookalikeCheckActive: false,
  domainAgeAvailable: false,
  disclaimer: ADVISORY_DISCLAIMER,
};

const INCOMPLETE: IncompleteScanResult = {
  ...RESULT,
  deterministicStatus: "incomplete",
  incompleteChecks: ["scam_triggers"],
  riskScore: null,
  severityTier: null,
  waxSealColor: null,
};

let mounted: Rendered[] = [];
function mount(ui: Parameters<typeof render>[0]) {
  const r = render(ui);
  mounted.push(r);
  return r;
}

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let anchorClicks: { href: string; download: string }[];

beforeEach(() => {
  createObjectURL = vi.fn(() => "blob:mock-1");
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  anchorClicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    anchorClicks.push({ href: this.getAttribute("href") ?? "", download: this.download });
  });
});

afterEach(() => {
  mounted.forEach((r) => r.unmount());
  mounted = [];
  vi.restoreAllMocks();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
});

function buttons(c: HTMLElement) {
  const all = [...c.querySelectorAll("button")];
  return {
    copy: all.find((b) => b.textContent === COPY_LABEL)!,
    pdf: all.find((b) => b.textContent === DOWNLOAD_PDF_LABEL)!,
    txt: all.find((b) => b.textContent === DOWNLOAD_TXT_LABEL)!,
  };
}
/** Reads a Blob's raw bytes as a Latin-1 string (for the PDF). */
function readBlobBytes(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer), (c) => String.fromCharCode(c)).join(""));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
/** Reads a Blob with FileReader (available in jsdom). */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

const status = (c: HTMLElement) => c.querySelector("[aria-live]") as HTMLElement;

async function clickAsync(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

describe("EvidenceReportExport", () => {
  it("disables all three buttons until a scan result exists", () => {
    const r = mount(<EvidenceReportExport result={null} />);
    let b = buttons(r.container);
    for (const btn of Object.values(b)) expect(btn.disabled).toBe(true);
    expect(b.copy.type).toBe("button");
    r.rerender(<EvidenceReportExport result={RESULT} />);
    b = buttons(r.container);
    for (const btn of Object.values(b)) expect(btn.disabled).toBe(false);
    expect([...r.container.querySelectorAll("button")].map((x) => x.textContent)).toEqual([COPY_LABEL, DOWNLOAD_PDF_LABEL, DOWNLOAD_TXT_LABEL]);
  });

  it("buttons are native, focusable, and have a visible focus style class", () => {
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    for (const b of Object.values(buttons(container))) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.className).toContain("focus-visible:outline");
    }
  });

  it("copies exactly the plain-text report (no Markdown symbols) and confirms", async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    setClipboard({ writeText });
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(container).copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(buildPlainTextReport(RESULT));
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied).not.toMatch(/^#/m);
    expect(copied).not.toContain("**");
    expect(copied).toContain("hxxps://short[.]example/abc");
    expect(status(container).textContent).toBe(COPY_SUCCESS);
    expect(status(container).getAttribute("aria-live")).toBe("polite");
  });

  it("copy failure shows an error, keeps the report, and a retry sends the same text", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValueOnce(undefined);
    setClipboard({ writeText });
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(container).copy);
    expect(status(container).textContent).toBe(COPY_FAILURE);
    expect(status(container).dataset.exportStatus).toBe("error");
    expect(buttons(container).copy.disabled).toBe(false);
    await clickAsync(buttons(container).copy);
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText.mock.calls[0][0]).toBe(writeText.mock.calls[1][0]);
    expect(writeText.mock.calls[1][0]).toBe(buildPlainTextReport(RESULT));
    expect(status(container).textContent).toBe(COPY_SUCCESS);
  });

  it("copy reports an error when the Clipboard API is unavailable", async () => {
    setClipboard(undefined);
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(container).copy);
    expect(status(container).textContent).toBe(COPY_FAILURE);
  });

  it("Download PDF saves a real PDF file (application/pdf) with the UTC timestamped name", async () => {
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(container).pdf);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    const pdf = await readBlobBytes(blob);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("(Scored deterministic findings) Tj");
    const filename = reportFilenameWithExtension(RESULT.timestamp, "pdf");
    expect(filename).toBe("scryvorn-report-20261114-064812.pdf"); // +02:00 -> UTC
    expect(anchorClicks).toEqual([{ href: "blob:mock-1", download: filename }]);
    expect(document.querySelector("a[download]")).toBeNull(); // temporary anchor removed
    expect(status(container).textContent).toBe(downloadStarted(filename));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
  });

  it("Download .txt saves the same plain-text report as text/plain", async () => {
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(container).txt);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/plain;charset=utf-8");
    expect(await readBlob(blob)).toBe(buildPlainTextReport(RESULT));
    const filename = reportFilenameWithExtension(RESULT.timestamp, "txt");
    expect(anchorClicks).toEqual([{ href: "blob:mock-1", download: filename }]);
    expect(status(container).textContent).toBe(downloadStarted(filename));
  });

  it("says so (never silently) when the PDF cannot show some characters", async () => {
    const withCjk = { ...RESULT, deterministicFindings: [{ ...RESULT.deterministicFindings[0], evidence: "你好 destination hidden" }] };
    const { container } = mount(<EvidenceReportExport result={withCjk} />);
    await clickAsync(buttons(container).pdf);
    const pdf = await readBlobBytes(createObjectURL.mock.calls[0][0] as Blob);
    expect(pdf).toContain("could not be shown in the PDF");
    expect(status(container).textContent).toBe(
      `${downloadStarted(reportFilenameWithExtension(RESULT.timestamp, "pdf"))} ${PDF_SUBSTITUTION_STATUS}`,
    );
  });

  it("download failure shows an error and a retry requests the same report", async () => {
    createObjectURL.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    const { container } = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(container).txt);
    expect(status(container).textContent).toBe(DOWNLOAD_FAILURE);
    expect(anchorClicks).toHaveLength(0);
    expect(buttons(container).txt.disabled).toBe(false);
    await clickAsync(buttons(container).txt);
    expect(await readBlob(createObjectURL.mock.calls[1][0] as Blob)).toBe(buildPlainTextReport(RESULT));
    expect(anchorClicks).toHaveLength(1);
  });

  it("exports incomplete results (report states the assessment is incomplete)", async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    setClipboard({ writeText });
    const { container } = mount(<EvidenceReportExport result={INCOMPLETE} />);
    await clickAsync(buttons(container).copy);
    expect(writeText).toHaveBeenCalledWith(buildPlainTextReport(INCOMPLETE));
    expect(String(writeText.mock.calls[0][0])).toContain("Assessment incomplete");
  });

  it("clears a previous status when a new result arrives", async () => {
    setClipboard({ writeText: vi.fn((_text: string) => Promise.resolve()) });
    const r = mount(<EvidenceReportExport result={RESULT} />);
    await clickAsync(buttons(r.container).copy);
    expect(status(r.container).textContent).toBe(COPY_SUCCESS);
    r.rerender(<EvidenceReportExport result={{ ...RESULT, timestamp: "2026-11-15T00:00:00Z" }} />);
    expect(status(r.container).textContent).toBe("");
  });

  it("an invalid timestamp disables export and shows a build error", () => {
    const { container } = mount(<EvidenceReportExport result={{ ...RESULT, timestamp: "not a date" }} />);
    for (const btn of Object.values(buttons(container))) expect(btn.disabled).toBe(true);
    expect(status(container).textContent).toBe(BUILD_FAILURE);
  });
});
