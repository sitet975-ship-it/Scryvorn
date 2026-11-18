import { isScanResult } from "@/lib/scan/scanClient";
import { buildPlainTextReport } from "@/lib/report/reportDocument";
import type { ScanResult } from "@/lib/types";

/**
 * Saved Investigations: the one deliberate, disclosed persistence feature
 * (see .kiro/steering/product.md, "Disclosed exception: Saved
 * Investigations").
 *
 * - Storage: this browser's localStorage only, under one key. Nothing is sent
 *   to a server, and there are no accounts. Another browser or device, or
 *   clearing site data, starts empty.
 * - Saved automatically when an investigation completes (a valid ScanResult).
 * - Each entry keeps the submitted text, the full ScanResult (findings, risk
 *   score, tier, AI interpretation, timestamps), the plain-text Evidence
 *   Report built at save time, and the time it was saved.
 * - Users delete entries individually or all at once.
 * - At most MAX_SAVED entries are kept; the oldest is dropped first.
 *
 * This is the only module that touches Web Storage. Every function tolerates
 * storage being unavailable (private modes, blocked storage, quota) and
 * corrupted or tampered data: invalid entries are skipped, never rendered.
 */

export const SAVED_INVESTIGATIONS_KEY = "scryvorn.savedInvestigations.v1";
export const MAX_SAVED = 25;

export interface SavedInvestigation {
  id: string;
  /** ISO 8601 time the entry was saved in this browser. */
  savedAt: string;
  /** The submitted message and/or URL, exactly as examined. */
  input: string;
  result: ScanResult;
  /** Plain-text Evidence Report built when the investigation was saved. */
  report: string;
}

export type SaveOutcome = { ok: true; entries: SavedInvestigation[]; saved: SavedInvestigation } | { ok: false };

/** The browser's localStorage, or null if unavailable or blocked. */
export function browserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

const isString = (v: unknown): v is string => typeof v === "string";
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Findings must have text fields the UI renders as text, so tampered data cannot break rendering. */
function hasRenderableFindings(result: ScanResult): boolean {
  const ok = (f: unknown) =>
    isObject(f) &&
    isString(f.id) &&
    isString(f.label) &&
    isString(f.evidence) &&
    isString(f.category) &&
    isString(f.severity) &&
    typeof f.weight === "number" &&
    ["url", "matchedText", "suspectedLegitDomain", "reference"].every((k) => f[k] === undefined || isString(f[k]));
  return result.deterministicFindings.every(ok) && result.aiFindings.every(ok);
}

export function isSavedInvestigation(v: unknown): v is SavedInvestigation {
  return (
    isObject(v) &&
    isString(v.id) &&
    v.id.length > 0 &&
    isString(v.savedAt) &&
    !Number.isNaN(Date.parse(v.savedAt)) &&
    isString(v.input) &&
    isString(v.report) &&
    isScanResult(v.result) &&
    hasRenderableFindings(v.result)
  );
}

/** Saved entries, newest first. Returns [] if storage is unavailable or the data is unreadable. */
export function loadSaved(storage: Storage | null = browserStorage()): SavedInvestigation[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_INVESTIGATIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedInvestigation).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function write(storage: Storage, entries: SavedInvestigation[]): boolean {
  try {
    if (entries.length === 0) storage.removeItem(SAVED_INVESTIGATIONS_KEY);
    else storage.setItem(SAVED_INVESTIGATIONS_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function newId(now: Date): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `inv-${now.getTime().toString(36)}-${rand}`;
}

/**
 * Saves a completed investigation (newest first). If the browser's storage
 * quota is reached, the oldest entries are dropped until it fits. Returns
 * { ok: false } if it cannot be saved at all.
 */
export function saveInvestigation(
  input: string,
  result: ScanResult,
  storage: Storage | null = browserStorage(),
  now: Date = new Date(),
): SaveOutcome {
  if (!storage || !isScanResult(result)) return { ok: false };
  let report: string;
  try {
    report = buildPlainTextReport(result);
  } catch {
    return { ok: false };
  }
  const saved: SavedInvestigation = { id: newId(now), savedAt: now.toISOString(), input, result, report };
  let entries = [saved, ...loadSaved(storage)].slice(0, MAX_SAVED);
  while (entries.length > 0) {
    if (write(storage, entries)) return entries[0] === saved ? { ok: true, entries, saved } : { ok: false };
    entries = entries.slice(0, -1); // drop the oldest and retry (quota)
  }
  return { ok: false };
}

/** Removes one entry. Returns the remaining entries (unchanged if storage fails). */
export function deleteSaved(id: string, storage: Storage | null = browserStorage()): SavedInvestigation[] {
  const current = loadSaved(storage);
  if (!storage) return current;
  const next = current.filter((e) => e.id !== id);
  return write(storage, next) ? next : current;
}

/** Removes every saved investigation. Returns true on success. */
export function clearSaved(storage: Storage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(SAVED_INVESTIGATIONS_KEY);
    return true;
  } catch {
    return false;
  }
}
