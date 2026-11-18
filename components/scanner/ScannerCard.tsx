"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SAMPLE_TRAPS } from "@/lib/samples/sampleTraps";
import { requestScan, type ScanRequestOptions } from "@/lib/scan/scanClient";
import {
  browserStorage,
  clearSaved,
  deleteSaved,
  loadSaved,
  saveInvestigation,
  type SavedInvestigation,
} from "@/lib/storage/savedInvestigations";
import type { ScanResult } from "@/lib/types";
import { Cobweb } from "@/components/halloween/Cobweb";
import { ForensicRadar } from "@/components/inspect/ForensicRadar";
import { EvidenceReportView } from "./EvidenceReportView";
import { LoadingState } from "./LoadingState";
import { PANEL, ResultsPanel } from "./ResultsPanel";
import { SampleTrapButtons, type SampleTrap } from "./SampleTrapButtons";
import { SavedInvestigations, formatUtc } from "./SavedInvestigations";
import { ScannerInput } from "./ScannerInput";
import { WaxSealVerdict } from "./WaxSealVerdict";

/**
 * The SCRYVORN inspection app (route /inspect).
 *
 * One scan state machine, connected to the real backend through scanClient
 * (POST /api/scan, which runs runDeterministicChecks, the AI interpretation,
 * and assessScan). Nothing here produces or simulates results:
 * - idle
 * - loading: previous result cleared immediately, input kept. The loading
 *   view is shown only while the real request is in flight.
 * - success(result): any 200 with a valid ScanResult, including AI-unavailable
 *   and incomplete deterministic runs (shown by the result components).
 * - error(kind): input_required / input_too_long are shown inline by
 *   ScannerInput; everything else shows one generic retryable message.
 *
 * Four views (data-view):
 * - awaiting   idle or error: message input + radar ("Not every threat ...")
 * - examining  loading: the same workspace, radar active, "The veil is lifting."
 * - revealed   success: ResultsPanel ("The deception, revealed.")
 * - preserved  success + report open: the real Evidence_Report and export
 *              ("Evidence, preserved.")
 *
 * The input is kept on every failure. "Start a new investigation" begins a
 * fresh examination: it clears the input and the result and focuses the box.
 *
 * Saved Investigations (the one disclosed persistence feature): every
 * completed investigation (success) is saved automatically, only in this
 * browser, through lib/storage/savedInvestigations, together with the
 * submitted text. Saved entries can be reopened (same views, same report),
 * deleted one by one, or cleared. The disclosure is shown beside the input
 * and in the Saved Investigations panel. No other state is persisted.
 *
 * A step indicator (Submit, Examine, Results, Report) shows where the user is
 * in the investigation. Decorative elements are aria-hidden and sit in panel
 * corners without covering content.
 */
export const SCANNER_CARD_HEADING = "What found its way to you?";
export const GENERIC_SCAN_ERROR =
  "The scan could not be completed. Your text is still in the box. Please try again.";

export const HERO_EYEBROW = "BEWARE WHAT FINDS YOU.";
export const FORENSIC_LAYERS_LINE = "MESSAGE TEXT · LINKS & DOMAINS · AI INTERPRETATION · VERDICT";
export const HEADLINES = {
  awaiting: { title: "Some messages hide darker intentions.", subtitle: "Bring the suspicious into the light." },
  examining: { title: "Some messages hide darker intentions.", subtitle: "Bring the suspicious into the light." },
  revealed: { title: "The deception, revealed.", subtitle: "An automated assessment. Evidence, not a guarantee." },
  preserved: { title: "Evidence, preserved.", subtitle: "A transparent record of this investigation." },
} as const;
export const OFFERING_EYEBROW = "01 / THE OFFERING";
export const VEIL_EYEBROW = "02 / BEYOND THE VEIL";
export const AWAITING_TITLE = "Not every threat announces itself.";
export const AWAITING_TEXT = "Look beyond the urgency. Follow the evidence, not the fear.";
export const EXAMINING_TITLE = "The veil is lifting.";
export const SAMPLES_CAPTION = "Or try a synthetic sample:";
export const VIEW_REPORT_LABEL = "View the evidence report →";
export const NEW_INVESTIGATION_LABEL = "Start a new investigation";
export const BACK_TO_ASSESSMENT_LABEL = "← Back to assessment";
export const SAVE_DISCLOSURE =
  "Completed investigations, including this text, are saved only in this browser. Manage them in Saved Investigations below.";
export const SAVED_STATUS = "Investigation saved in this browser.";
export const SAVE_FAILED_STATUS = "This investigation could not be saved in this browser. The results below are unaffected.";
export const savedViewNotice = (when: string) => `Saved investigation, examined ${when}. Reopened from this browser.`;
export const STEPS = ["Submit", "Examine", "Results", "Report"] as const;
export const STEPS_LABEL = "Investigation progress";
export const EXAMINING_STAGES = [
  "Rule-based checks of the text and any links",
  "AI interpretation of social-engineering patterns",
  "Risk score, evidence, and next steps",
] as const;
export const EXAMINING_NOTE = "These run in order for this request. The results appear when all three finish.";

export type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: ScanResult }
  | { status: "error"; kind: "input_required" | "input_too_long" | "retryable" };

export type View = keyof typeof HEADLINES;

export interface ScannerCardProps {
  samples?: readonly SampleTrap[];
  /** Injected for tests; defaults to the global fetch and the 45 s timeout. */
  requestOptions?: Pick<ScanRequestOptions, "fetchImpl" | "timeoutMs">;
  /** Injected for tests; defaults to this browser's storage via browserStorage() (null when unavailable). */
  storage?: Storage | null;
}

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.22em] text-scry-amber";
const ACTION_PRIMARY =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm border border-scry-amber/40 bg-scry-crimson px-6 py-3 font-bold tracking-wide text-scry-ivory shadow-amber-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber";
const ACTION_SECONDARY =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm border border-scry-amber/50 bg-scry-bg/70 px-6 py-3 font-semibold text-scry-ivory transition hover:border-scry-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber";

const STEP_INDEX: Record<View, number> = { awaiting: 0, examining: 1, revealed: 2, preserved: 3 };

/** Where the user is in the investigation (not interactive). */
function InvestigationSteps({ view }: { view: View }) {
  const current = STEP_INDEX[view];
  return (
    <ol aria-label={STEPS_LABEL} data-steps="" className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em]">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 ${
              i === current
                ? "border-scry-amber bg-scry-crimson/40 text-scry-ivory"
                : i < current
                  ? "border-scry-border text-scry-ivory/80"
                  : "border-scry-border/60 text-scry-muted"
            }`}
          >
            <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            {s}
          </span>
          {i < STEPS.length - 1 ? (
            <span aria-hidden="true" className="text-scry-muted">
              ›
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Text with a trailing or leading decorative arrow kept out of the accessible name. */
function ArrowLabel({ label }: { label: string }) {
  const trailing = label.endsWith(" →");
  const leading = label.startsWith("← ");
  const text = trailing ? label.slice(0, -1) : leading ? label.slice(2) : label;
  return (
    <>
      {leading ? <span aria-hidden="true">{"← "}</span> : null}
      {text}
      {trailing ? <span aria-hidden="true">→</span> : null}
    </>
  );
}

export function ScannerCard({ samples = SAMPLE_TRAPS, requestOptions, storage: injectedStorage }: ScannerCardProps) {
  const getStorage = () => (injectedStorage === undefined ? browserStorage() : injectedStorage);
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const [input, setInput] = useState("");
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const [reportOpen, setReportOpen] = useState(false);
  const [saved, setSaved] = useState<SavedInvestigation[]>([]);
  const [storageChecked, setStorageChecked] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [openedSaved, setOpenedSaved] = useState<SavedInvestigation | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"" | "saved" | "failed">("");
  const requestId = useRef(0);
  const unmountController = useRef<AbortController | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingFocus = useRef<"title" | "input" | null>(null);

  useEffect(() => {
    unmountController.current = new AbortController();
    return () => unmountController.current?.abort();
  }, []);

  // Saved Investigations are read after mount (the browser's storage does not exist during server rendering).
  useEffect(() => {
    const storage = getStorage();
    setStorageAvailable(storage !== null);
    setSaved(loadSaved(storage));
    setStorageChecked(true);
    // Read once on mount; the storage source does not change during a session.
  }, []);

  const loading = state.status === "loading";
  const result = state.status === "success" ? state.result : null;
  const serverError =
    state.status === "error" && state.kind !== "retryable" ? state.kind : null;
  const retryable = state.status === "error" && state.kind === "retryable";
  const view: View = result ? (reportOpen ? "preserved" : "revealed") : loading ? "examining" : "awaiting";

  // Move focus deliberately after view changes triggered by the user or a
  // completed scan, so keyboard and screen-reader users land on the new view.
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "title") titleRef.current?.focus();
    if (target === "input") textareaRef.current?.focus();
  }, [view]);

  function changeInput(next: string) {
    setInput(next);
    // A new edit replaces any server validation message.
    if (state.status === "error" && state.kind !== "retryable") setState({ status: "idle" });
  }

  async function scan(value: string) {
    const id = ++requestId.current;
    setReportOpen(false);
    setOpenedSaved(null);
    setActiveSavedId(null);
    setSaveStatus("");
    setState({ status: "loading" });
    const outcome = await requestScan(value, {
      ...requestOptions,
      signal: unmountController.current?.signal,
    });
    if (id !== requestId.current || unmountController.current?.signal.aborted) return;
    if (outcome.ok) {
      pendingFocus.current = "title";
      // Automatic, disclosed save of the completed investigation (this browser only).
      const storage = getStorage();
      if (storage) {
        const s = saveInvestigation(value, outcome.result, storage);
        if (s.ok) {
          setSaved(s.entries);
          setActiveSavedId(s.saved.id);
          setSaveStatus("saved");
        } else {
          setSaveStatus("failed");
        }
      }
    }
    setState(outcome.ok ? { status: "success", result: outcome.result } : { status: "error", kind: outcome.kind });
  }

  function openSaved(entry: SavedInvestigation) {
    if (loading) return;
    requestId.current++;
    pendingFocus.current = "title";
    setInput(entry.input);
    setReportOpen(false);
    setOpenedSaved(entry);
    setActiveSavedId(entry.id);
    setSaveStatus("");
    setState({ status: "success", result: entry.result });
    titleRef.current?.scrollIntoView?.({ block: "start" });
  }

  function removeSaved(id: string) {
    setSaved(deleteSaved(id, getStorage()));
    if (activeSavedId === id) setActiveSavedId(null);
  }

  function clearAllSaved() {
    const storage = getStorage();
    if (clearSaved(storage)) {
      setSaved([]);
      setActiveSavedId(null);
    } else {
      setSaved(loadSaved(storage));
    }
  }

  function openReport() {
    pendingFocus.current = "title";
    setReportOpen(true);
  }

  function backToAssessment() {
    pendingFocus.current = "title";
    setReportOpen(false);
  }

  /** Begins a fresh examination: empty input, no result, focus in the box. */
  function newInvestigation() {
    pendingFocus.current = "input";
    setInput("");
    setReportOpen(false);
    setOpenedSaved(null);
    setActiveSavedId(null);
    setSaveStatus("");
    setState({ status: "idle" });
  }

  const headline = HEADLINES[view];

  return (
    <div
      data-scan-state={state.status}
      data-view={view}
      className="mx-auto w-full max-w-6xl break-words px-4 pb-10 pt-8 sm:px-6 sm:pt-12"
    >
      <header className="max-w-3xl">
        <p className={EYEBROW}>{HERO_EYEBROW}</p>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="mt-3 font-serif text-4xl font-medium leading-[1.08] text-scry-ivory focus:outline-none sm:text-5xl lg:text-6xl"
        >
          {headline.title}
        </h1>
        <p className="mt-3 text-base text-scry-muted sm:text-lg">{headline.subtitle}</p>
        <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.2em] text-scry-muted">{FORENSIC_LAYERS_LINE}</p>
        <InvestigationSteps view={view} />
      </header>

      <p
        aria-live="polite"
        data-scan-error={retryable ? "retryable" : ""}
        className={`mt-6 text-sm font-semibold text-scry-ivory ${retryable ? "border-l-4 border-scry-danger bg-scry-card/90 py-2 pl-3" : ""}`}
      >
        {retryable ? GENERIC_SCAN_ERROR : ""}
      </p>

      {view === "awaiting" || view === "examining" ? (
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section aria-labelledby={headingId} data-panel="offering" className={`${PANEL} flex flex-col gap-4`}>
            <Cobweb size={64} opacity={0.2} className="absolute left-0 top-0" />
            <p className={EYEBROW}>{OFFERING_EYEBROW}</p>
            <h2 id={headingId} className="font-serif text-3xl font-medium text-scry-ivory">
              {SCANNER_CARD_HEADING}
            </h2>
            <ScannerInput
              ref={textareaRef}
              value={input}
              onChange={changeInput}
              onSubmit={scan}
              loading={loading}
              serverError={serverError}
            />
            <p data-save-disclosure="" className="text-xs leading-relaxed text-scry-muted">
              {SAVE_DISCLOSURE}
            </p>
            <div className="flex flex-col gap-2 border-t border-scry-border pt-4">
              <p className="text-sm text-scry-muted">{SAMPLES_CAPTION}</p>
              <SampleTrapButtons samples={samples} onSelect={changeInput} disabled={loading} />
            </div>
          </section>

          <section
            aria-label={view === "examining" ? EXAMINING_TITLE : AWAITING_TITLE}
            data-panel="veil"
            className={`${PANEL} scry-ambient-panel flex flex-col items-center gap-5 text-center`}
          >
            <Cobweb size={64} flip opacity={0.2} className="absolute right-0 top-0" />
            <p className={`${EYEBROW} self-start`}>{VEIL_EYEBROW}</p>
            <ForensicRadar active={loading} label={loading ? "Examining" : "Awaiting evidence"} />
            <h2 className="font-serif text-3xl font-medium text-scry-ivory">
              {view === "examining" ? EXAMINING_TITLE : AWAITING_TITLE}
            </h2>
            {view === "examining" ? (
              <div data-examining-stages="" className="flex w-full max-w-sm flex-col gap-3 text-left">
                <ol className="flex flex-col gap-2">
                  {EXAMINING_STAGES.map((s, i) => (
                    <li key={s} className="flex items-start gap-3 rounded-sm border border-scry-border bg-scry-bg/60 px-3 py-2 text-sm text-scry-ivory">
                      <span aria-hidden="true" className="font-serif text-scry-amber tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-scry-muted">{EXAMINING_NOTE}</p>
              </div>
            ) : (
              <p className="max-w-xs text-sm text-scry-muted">{AWAITING_TEXT}</p>
            )}
            <LoadingState active={loading} />
          </section>
        </div>
      ) : (
        <div className="sr-only">
          <LoadingState active={false} />
        </div>
      )}

      <p aria-live="polite" data-save-status={saveStatus} className="text-sm text-scry-muted empty:hidden">
        {saveStatus === "saved" ? SAVED_STATUS : saveStatus === "failed" ? SAVE_FAILED_STATUS : ""}
      </p>

      {openedSaved && result ? (
        <p data-saved-view="" className="mt-2 border-l-4 border-scry-amber/70 bg-scry-card/90 py-2 pl-3 text-sm font-semibold text-scry-ivory">
          {savedViewNotice(formatUtc(openedSaved.result.timestamp))}
        </p>
      ) : null}

      {view === "revealed" && result ? (
        <div className="mt-4 flex flex-col gap-6">
          <ResultsPanel result={result} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={openReport} className={ACTION_PRIMARY}>
              <ArrowLabel label={VIEW_REPORT_LABEL} />
            </button>
            <button type="button" onClick={newInvestigation} className={ACTION_SECONDARY}>
              {NEW_INVESTIGATION_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      {view === "preserved" && result ? (
        <div className="mt-4 flex flex-col gap-6">
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className={PANEL}>
              <EvidenceReportView result={result} />
            </div>
            <div className={PANEL}>
              <WaxSealVerdict result={result} compact />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={backToAssessment} className={ACTION_SECONDARY}>
              <ArrowLabel label={BACK_TO_ASSESSMENT_LABEL} />
            </button>
            <button type="button" onClick={newInvestigation} className={ACTION_SECONDARY}>
              {NEW_INVESTIGATION_LABEL}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <SavedInvestigations
          entries={saved}
          available={storageAvailable}
          checked={storageChecked}
          activeId={activeSavedId}
          disabled={loading}
          onOpen={openSaved}
          onDelete={removeSaved}
          onClearAll={clearAllSaved}
        />
      </div>
    </div>
  );
}
