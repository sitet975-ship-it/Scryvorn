"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SAMPLE_TRAPS } from "@/lib/samples/sampleTraps";
import { requestScan, type ScanRequestOptions } from "@/lib/scan/scanClient";
import type { ScanResult } from "@/lib/types";
import { SpiderwebCorners } from "@/components/theme/SpiderwebCorners";
import { AiInterpretation } from "./AiInterpretation";
import { EvidenceReportExport } from "./EvidenceReportExport";
import { LoadingState } from "./LoadingState";
import { RecommendedSteps } from "./RecommendedSteps";
import { SampleTrapButtons, type SampleTrap } from "./SampleTrapButtons";
import { ScannerInput } from "./ScannerInput";
import { VerifiedChecks } from "./VerifiedChecks";
import { WaxSealVerdict } from "./WaxSealVerdict";

/**
 * Scanner card: input, samples, loading state, and results.
 *
 * One scan state machine:
 * - idle
 * - loading: previous result cleared immediately, input kept, LoadingState on.
 * - success(result): any 200 with a valid ScanResult, including AI-unavailable
 *   and incomplete deterministic runs (those are shown by the result
 *   components, not as page errors).
 * - error(kind): input_required / input_too_long are shown inline by
 *   ScannerInput; everything else shows one generic retryable message.
 *
 * The input is kept on every failure. State lives only in React memory:
 * nothing is written to Web Storage, IndexedDB, cookies, or files, so a
 * refresh or navigation clears it.
 *
 * Layout: vertical padding equals the spiderweb corner size (64 px, 80 px
 * from the sm breakpoint) so the corner accents sit in the padding bands
 * above and below the content. jsdom cannot verify this; it needs a manual
 * browser check.
 */
export const SCANNER_CARD_HEADING = "Inspect a suspicious message or link";
export const GENERIC_SCAN_ERROR =
  "The scan could not be completed. Your text is still in the box. Please try again.";

export type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: ScanResult }
  | { status: "error"; kind: "input_required" | "input_too_long" | "retryable" };

export interface ScannerCardProps {
  samples?: readonly SampleTrap[];
  /** Injected for tests; defaults to the global fetch and the 45 s timeout. */
  requestOptions?: Pick<ScanRequestOptions, "fetchImpl" | "timeoutMs">;
}

export function ScannerCard({ samples = SAMPLE_TRAPS, requestOptions }: ScannerCardProps) {
  const headingId = `${useId()}-heading`;
  const [input, setInput] = useState("");
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const requestId = useRef(0);
  const unmountController = useRef<AbortController | null>(null);

  useEffect(() => {
    unmountController.current = new AbortController();
    return () => unmountController.current?.abort();
  }, []);

  const loading = state.status === "loading";
  const result = state.status === "success" ? state.result : null;
  const serverError =
    state.status === "error" && state.kind !== "retryable" ? state.kind : null;

  function changeInput(next: string) {
    setInput(next);
    // A new edit replaces any server validation message.
    if (state.status === "error" && state.kind !== "retryable") setState({ status: "idle" });
  }

  async function scan(value: string) {
    const id = ++requestId.current;
    setState({ status: "loading" });
    const outcome = await requestScan(value, {
      ...requestOptions,
      signal: unmountController.current?.signal,
    });
    if (id !== requestId.current || unmountController.current?.signal.aborted) return;
    setState(outcome.ok ? { status: "success", result: outcome.result } : { status: "error", kind: outcome.kind });
  }

  return (
    <section
      aria-labelledby={headingId}
      data-scan-state={state.status}
      className="relative mx-auto w-full max-w-3xl break-words rounded-lg bg-aged-parchment px-4 py-16 text-dark-ink shadow-lg sm:px-8 sm:py-20"
    >
      <SpiderwebCorners />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 id={headingId} className="text-2xl font-bold">
            {SCANNER_CARD_HEADING}
          </h2>
          <SampleTrapButtons samples={samples} onSelect={changeInput} disabled={loading} />
          <ScannerInput
            value={input}
            onChange={changeInput}
            onSubmit={scan}
            loading={loading}
            serverError={serverError}
          />
          <LoadingState active={loading} />
          <p
            aria-live="polite"
            data-scan-error={state.status === "error" && state.kind === "retryable" ? "retryable" : ""}
            className={`text-sm font-semibold text-dark-ink ${
              state.status === "error" && state.kind === "retryable" ? "border-l-4 border-crimson-wax pl-2" : ""
            }`}
          >
            {state.status === "error" && state.kind === "retryable" ? GENERIC_SCAN_ERROR : ""}
          </p>
        </div>

        {result ? (
          <div data-results="" className="flex min-w-0 flex-col gap-8 border-t border-dark-ink/20 pt-6">
            <WaxSealVerdict result={result} />
            <VerifiedChecks result={result} />
            <AiInterpretation result={result} />
            <RecommendedSteps result={result} />
          </div>
        ) : null}
        {/* Always rendered so the buttons stay visibly disabled until a scan completes. */}
        <EvidenceReportExport result={result} />
      </div>
    </section>
  );
}
