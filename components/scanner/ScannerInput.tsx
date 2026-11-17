"use client";

import { forwardRef, useId, useState, type ClipboardEvent, type FormEvent } from "react";
import { INPUT_MAX_CHARS } from "@/lib/constants";

/**
 * Controlled scanner input: textarea, live character counter, and submit.
 *
 * - Length is JavaScript string `.length` (UTF-16 code units), the same
 *   measure the server uses against INPUT_MAX_CHARS.
 * - Input is never truncated. A change or paste that would exceed the limit
 *   is rejected: the existing content stays unchanged, submission is blocked,
 *   and an inline error is shown until the next accepted edit.
 * - Empty-after-trim submission is blocked, keeps the content, and shows
 *   "Input required."
 * - Errors are announced through an always-present aria-live region and
 *   linked to the textarea with aria-describedby / aria-invalid.
 * - Submission is disabled while `loading`.
 * - `serverError` shows a server-returned validation error (input_required or
 *   input_too_long) in the same live region. A client-side error takes
 *   precedence. The parent clears `serverError` when the input changes.
 * - Error text is ivory on the dark card; the danger red is only a left
 *   accent border, so the message never depends on red-text contrast.
 * - The submit arrow is decorative (aria-hidden): the accessible name is
 *   "Examine the evidence".
 */
export const SUBMIT_LABEL = "Examine the evidence →";
export const INPUT_REQUIRED_MESSAGE = "Input required.";
export const INPUT_TOO_LONG_MESSAGE = "Maximum input length exceeded (10,000 characters).";
/** Visible prompt inside the empty textarea (the label names the field). */
export const INPUT_PLACEHOLDER = "A message that feels wrong.\nA link you don't quite trust.\nBring it here.";

const SUBMIT_TEXT = "Examine the evidence ";
const SUBMIT_ARROW = "→";

const formatCount = (n: number) => n.toLocaleString("en-US");
type InputError = "required" | "too_long" | null;
export type ServerInputError = "input_required" | "input_too_long";

export interface ScannerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  loading?: boolean;
  serverError?: ServerInputError | null;
}

export const ScannerInput = forwardRef<HTMLTextAreaElement, ScannerInputProps>(function ScannerInput(
  { value, onChange, onSubmit, loading = false, serverError = null },
  textareaRef,
) {
  const id = useId();
  const [error, setError] = useState<InputError>(null);
  const inputId = `${id}-input`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;

  function handleChange(next: string) {
    if (next.length > INPUT_MAX_CHARS) {
      setError("too_long");
      return; // keep the existing content unchanged
    }
    setError(null);
    onChange(next);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData?.getData("text") ?? "";
    const el = event.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const resulting = el.value.length - (end - start) + pasted.length;
    if (resulting > INPUT_MAX_CHARS) {
      event.preventDefault();
      setError("too_long");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (error === "too_long" || value.length > INPUT_MAX_CHARS) {
      setError("too_long");
      return;
    }
    if (value.trim() === "") {
      setError("required");
      return;
    }
    setError(null);
    onSubmit(value);
  }

  const shown: InputError =
    error ??
    (serverError === "input_required" ? "required" : serverError === "input_too_long" ? "too_long" : null);
  const message =
    shown === "required" ? INPUT_REQUIRED_MESSAGE : shown === "too_long" ? INPUT_TOO_LONG_MESSAGE : "";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-scry-ivory">
        Suspicious message or link
      </label>
      <textarea
        ref={textareaRef}
        id={inputId}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={handlePaste}
        rows={7}
        placeholder={INPUT_PLACEHOLDER}
        aria-invalid={shown ? true : undefined}
        aria-describedby={`${counterId} ${errorId}`}
        className="w-full resize-y rounded-sm border border-scry-border bg-scry-bg/80 p-4 leading-relaxed text-scry-ivory shadow-inner placeholder:font-serif placeholder:text-lg placeholder:italic placeholder:text-scry-muted focus-visible:border-scry-amber/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span id={counterId} data-counter="" className="tabular-nums text-scry-muted">
          {formatCount(value.length)} / {formatCount(INPUT_MAX_CHARS)}
        </span>
        <p
          id={errorId}
          aria-live="polite"
          data-error={shown ?? ""}
          className={`font-semibold text-scry-ivory ${message ? "border-l-4 border-scry-danger pl-2" : ""}`}
        >
          {message}
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm border border-scry-amber/40 bg-scry-crimson px-6 py-3 text-base font-bold tracking-wide text-scry-ivory shadow-amber-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber"
      >
        {SUBMIT_TEXT}
        <span aria-hidden="true">{SUBMIT_ARROW}</span>
      </button>
    </form>
  );
});
