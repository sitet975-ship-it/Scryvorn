import { SCORING_WEIGHTS } from "@/lib/constants";
import type { DeterministicFinding, ScamTriggerSet } from "./types";

/**
 * Scam trigger detector (pure, deterministic, no network).
 *
 * Matching rules:
 * - Case-insensitive.
 * - Runs of whitespace collapse to a single space; curly apostrophes
 *   (U+2018, U+2019, U+02BC) are treated as straight apostrophes.
 * - A phrase matches only on word boundaries: the characters immediately
 *   before and after the match must not be letters or digits, so "urgent"
 *   does not match inside "insurgent". Matching uses plain substring search
 *   (no RegExp), so phrases cannot inject regex syntax.
 *
 * Output: exactly one finding per matched category, in the category order of
 * the supplied set. `matchedText` is the earliest-occurring matched phrase as
 * written in the original input.
 *
 * Note: each finding carries `scam_trigger_each` weight. The cap
 * (`scam_trigger_max_total`) is applied by scoring (Task 5), not here.
 */

const WORD_CHAR = /[\p{L}\p{N}]/u;
const APOSTROPHES = new Set(["\u2018", "\u2019", "\u02BC"]);

interface Normalized {
  /** Lowercased, whitespace-collapsed, apostrophe-normalized text. */
  text: string;
  /** For each UTF-16 unit of `text`, the start index in the original. */
  starts: number[];
  /** For each UTF-16 unit of `text`, the end index (exclusive) in the original. */
  ends: number[];
}

function normalize(input: string): Normalized {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  for (const ch of input) {
    const start = i;
    i += ch.length;
    let out: string;
    if (/\s/u.test(ch)) {
      if (text === "" || text.endsWith(" ")) {
        // Leading whitespace or continuation of a run: extend the run's end.
        if (text.endsWith(" ")) ends[ends.length - 1] = i;
        continue;
      }
      out = " ";
    } else if (APOSTROPHES.has(ch)) {
      out = "'";
    } else {
      const lower = ch.toLowerCase();
      out = lower.length === ch.length ? lower : ch;
    }
    for (let k = 0; k < out.length; k++) {
      text += out[k];
      starts.push(start);
      ends.push(i);
    }
  }
  return { text, starts, ends };
}

function isBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return true;
  return !WORD_CHAR.test(text[index]);
}

/** Earliest word-boundary match index of `phrase` in `text`, or -1. */
function findPhrase(text: string, phrase: string): number {
  let from = 0;
  while (from <= text.length - phrase.length) {
    const idx = text.indexOf(phrase, from);
    if (idx === -1) return -1;
    if (isBoundary(text, idx - 1) && isBoundary(text, idx + phrase.length)) {
      return idx;
    }
    from = idx + 1;
  }
  return -1;
}

export function detectScamTriggers(
  text: string,
  triggerSet: ScamTriggerSet,
): DeterministicFinding[] {
  if (typeof text !== "string" || text.trim() === "") return [];

  const norm = normalize(text);
  const reference = `scamTriggers.json v${triggerSet.version} (${triggerSet.source}, ${triggerSet.date})`;
  const findings: DeterministicFinding[] = [];

  for (const category of triggerSet.categories) {
    const hits: { index: number; phrase: string; original: string }[] = [];
    const seen = new Set<string>();

    for (const phrase of category.phrases) {
      const needle = normalize(phrase).text;
      if (needle === "" || seen.has(needle)) continue;
      seen.add(needle);
      const idx = findPhrase(norm.text, needle);
      if (idx === -1) continue;
      const original = text.slice(
        norm.starts[idx],
        norm.ends[idx + needle.length - 1],
      );
      hits.push({ index: idx, phrase: needle, original });
    }

    if (hits.length === 0) continue;

    // Earliest occurrence first; ties broken by phrase text for determinism.
    hits.sort((a, b) => a.index - b.index || a.phrase.localeCompare(b.phrase));
    const first = hits[0];
    const evidence =
      hits.length === 1
        ? `Matched ${category.label} phrase "${first.original}".`
        : `Matched ${hits.length} distinct ${category.label} phrases: ${hits
            .map((h) => `"${h.original}"`)
            .join(", ")}.`;

    findings.push({
      id: `scam_trigger:${category.id}`,
      source: "deterministic",
      check: "scam_triggers",
      category: category.id,
      label: category.label,
      evidence,
      matchedText: first.original,
      reference,
      severity: "medium",
      weight: SCORING_WEIGHTS.deterministic.scam_trigger_each,
    });
  }

  return findings;
}
