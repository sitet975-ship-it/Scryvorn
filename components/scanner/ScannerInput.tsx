"use client";

import { useId, useState, type ClipboardEvent, type FormEvent } from "react";
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
 * - Error text is Dark Ink; Crimson Wax is used only as a left accent border
 *   (Crimson Wax text on parchment is about 4.36:1, below 4.5:1).
 */
export const SUBMIT_LABEL = "Inspect for Traps";
export const INPUT_REQUIRED_MESSAGE = "Input required.";
export const INPUT_TOO_LONG_MESSAGE = "Maximum input length exceeded (10,000 characters).";

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

export function ScannerInput({
  value,
  onChange,
  onSubmit,
  loading = false,
  serverError = null,
}: ScannerInputProps) {
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
      <label htmlFor={inputId} className="font-semibold">
        Suspicious message or link
      </label>
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={handlePaste}
        rows={8}
        aria-invalid={shown ? true : undefined}
        aria-describedby={`${counterId} ${errorId}`}
        className="w-full resize-y rounded border border-dark-ink/40 bg-white p-3 text-dark-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pumpkin-orange"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span id={counterId} data-counter="">
          {formatCount(value.length)} / {formatCount(INPUT_MAX_CHARS)}
        </span>
        <p
          id={errorId}
          aria-live="polite"
          data-error={shown ?? ""}
          className={`font-semibold text-dark-ink ${message ? "border-l-4 border-crimson-wax pl-2" : ""}`}
        >
          {message}
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="self-start rounded bg-pumpkin-orange px-5 py-2 text-lg font-bold text-dark-ink disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-ink"
      >
        {SUBMIT_LABEL}
      </button>
    </form>
  );
}
