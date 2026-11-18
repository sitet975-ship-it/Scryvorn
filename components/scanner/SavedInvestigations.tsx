"use client";

import { useId, useState } from "react";
import { defangText } from "@/lib/report/safeMarkdown";
import type { SavedInvestigation } from "@/lib/storage/savedInvestigations";

/**
 * Saved Investigations panel (route /inspect).
 *
 * The disclosure is always visible: investigations are saved automatically,
 * only in this browser, including the submitted text, and stay until the user
 * deletes them. Entries open without signing in. Each entry can be deleted;
 * Clear all asks for confirmation first. The excerpt is defanged plain text
 * (never a link), like everywhere else in the app.
 */
export const SAVED_HEADING = "Saved Investigations";
export const SAVED_EYEBROW = "03 / THE ARCHIVE";
export const SAVED_NOTICE =
  "Stored only in this browser. Completed investigations, including the text you submitted, are saved automatically on this device in this browser's local storage. They are not sent to a server or shared, and they stay until you delete them. Another browser or device will not show them.";
export const SAVED_EMPTY = "No saved investigations yet. Completed investigations appear here automatically.";
export const SAVED_UNAVAILABLE =
  "Saved Investigations are unavailable because this browser is blocking local storage. Investigations still work but are not saved.";
export const OPEN_LABEL = "Open";
export const DELETE_LABEL = "Delete";
export const CLEAR_ALL_LABEL = "Clear all";
export const CLEAR_CONFIRM_TEXT = "Delete every saved investigation from this browser? This cannot be undone.";
export const CLEAR_CONFIRM_LABEL = "Yes, clear all";
export const CLEAR_CANCEL_LABEL = "Cancel";
export const VIEWING_LABEL = "Currently open";

const EXCERPT_CHARS = 120;

/** "2026-11-14 08:48 UTC" from an ISO timestamp, or the raw value if unparseable. */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export function excerpt(input: string): string {
  const flat = defangText(input).replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS - 1)}…` : flat;
}

function verdictText(e: SavedInvestigation): string {
  const r = e.result;
  return r.deterministicStatus === "complete" ? `${r.severityTier} · Risk score ${r.riskScore}` : "Assessment incomplete · no score";
}

const BUTTON =
  "inline-flex min-h-[44px] items-center justify-center rounded-sm border border-scry-amber/50 bg-scry-bg/70 px-4 py-2 text-sm font-semibold text-scry-ivory transition hover:border-scry-amber disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber";

export interface SavedInvestigationsProps {
  entries: readonly SavedInvestigation[];
  /** false before the browser has been checked, or if storage is blocked. */
  available: boolean;
  /** true once the browser has been checked (avoids a flash of the unavailable notice). */
  checked: boolean;
  activeId: string | null;
  disabled?: boolean;
  onOpen: (entry: SavedInvestigation) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function SavedInvestigations({ entries, available, checked, activeId, disabled = false, onOpen, onDelete, onClearAll }: SavedInvestigationsProps) {
  const headingId = `${useId()}-saved`;
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-labelledby={headingId} data-section="saved-investigations" className="relative flex flex-col gap-4 rounded-sm border border-scry-border bg-scry-card/95 p-5 sm:p-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-scry-amber">{SAVED_EYEBROW}</p>
        <h2 id={headingId} className="font-serif text-2xl font-medium text-scry-ivory sm:text-3xl">
          {SAVED_HEADING}
        </h2>
        <p data-saved-notice="" className="border-l-4 border-scry-amber/70 pl-3 text-sm text-scry-ivory">
          {SAVED_NOTICE}
        </p>
      </div>

      {checked && !available ? <p className="text-sm text-scry-muted">{SAVED_UNAVAILABLE}</p> : null}
      {checked && available && entries.length === 0 ? <p className="text-sm text-scry-muted">{SAVED_EMPTY}</p> : null}

      {entries.length > 0 ? (
        <ul className="flex flex-col gap-3" data-saved-list="">
          {entries.map((e) => {
            const when = formatUtc(e.result.timestamp);
            const active = e.id === activeId;
            return (
              <li
                key={e.id}
                data-saved-id={e.id}
                className={`flex flex-col gap-3 rounded-sm border bg-scry-bg/60 p-4 sm:flex-row sm:items-center sm:justify-between ${active ? "border-scry-amber" : "border-scry-border"}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-xs font-semibold tracking-[0.12em] text-scry-muted">
                    <span>Examined {when}</span>
                    {active ? <span className="ml-2 text-scry-amber">· {VIEWING_LABEL}</span> : null}
                  </p>
                  <p className="text-sm font-semibold text-scry-ivory">{verdictText(e)}</p>
                  <p className="break-words text-sm text-scry-muted">{excerpt(e.input)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={BUTTON} disabled={disabled} onClick={() => onOpen(e)} aria-label={`${OPEN_LABEL} investigation examined ${when}`}>
                    {OPEN_LABEL}
                  </button>
                  <button type="button" className={BUTTON} disabled={disabled} onClick={() => onDelete(e.id)} aria-label={`${DELETE_LABEL} investigation examined ${when}`}>
                    {DELETE_LABEL}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {entries.length > 0 ? (
        confirming ? (
          <div role="group" aria-label={CLEAR_ALL_LABEL} className="flex flex-col gap-3 border-t border-scry-border pt-4 sm:flex-row sm:items-center">
            <p className="text-sm font-semibold text-scry-ivory">{CLEAR_CONFIRM_TEXT}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${BUTTON} border-scry-danger`}
                onClick={() => {
                  setConfirming(false);
                  onClearAll();
                }}
              >
                {CLEAR_CONFIRM_LABEL}
              </button>
              <button type="button" className={BUTTON} onClick={() => setConfirming(false)}>
                {CLEAR_CANCEL_LABEL}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-scry-border pt-4">
            <button type="button" className={BUTTON} disabled={disabled} onClick={() => setConfirming(true)}>
              {CLEAR_ALL_LABEL}
            </button>
          </div>
        )
      ) : null}
    </section>
  );
}
