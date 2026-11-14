/**
 * Converts untrusted text into inert Markdown for the Evidence_Report.
 *
 * Applied to finding labels, evidence, matched text, URLs, references, AI
 * text, steps, and any other value that is not a fixed report string. It only
 * transforms output; callers keep the original values in memory.
 *
 * Steps, in order:
 *  1. Line breaks and tabs become spaces (the value stays on one line, so it
 *     cannot start a heading, list, quote, table, or code fence).
 *  2. Control, zero-width, and bidirectional-override characters become
 *     U+FFFD (they can disguise a link's real text).
 *  3. URL schemes are defanged: http/https -> hxxp/hxxps; other "scheme://"
 *     -> "scheme[://]".
 *  4. Domain dots are defanged: an ASCII, ideographic, full-width, or halfwidth
 *     dot between a name character and a letter becomes "[.]".
 *  5. Markdown and HTML punctuation is backslash-escaped, so no raw HTML,
 *     links, images, emphasis, or code spans can form.
 *
 * Limitation: some viewers auto-link text heuristically; the absence of
 * automatic linking cannot be guaranteed in every Markdown viewer.
 */

const LINE_BREAKS = /\r\n|[\r\n\t\v\f\u0085\u2028\u2029]/g;
const INVISIBLE_OR_CONTROL =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const SCHEME = /\b([a-z][a-z0-9+.-]*):\/\//gi;
const DOMAIN_DOT = /([A-Za-z0-9-])[.\u3002\uFF0E\uFF61](?=[A-Za-z])/g;
const MARKDOWN_PUNCTUATION = /[\\`*_{}[\]()#+\-.!|<>~&]/g;

function defangScheme(_match: string, scheme: string): string {
  const http = /^(h)tt(ps?)$/i.exec(scheme);
  if (http) return `${http[1]}xx${http[2]}://`;
  return `${scheme}[://]`;
}

/**
 * Steps 1–4 only (no Markdown escaping), for showing untrusted text as plain
 * React text in the UI with the same defanging as the Evidence_Report.
 */
export function defangText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(LINE_BREAKS, " ")
    .replace(INVISIBLE_OR_CONTROL, "\uFFFD")
    .replace(SCHEME, defangScheme)
    .replace(DOMAIN_DOT, "$1[.]");
}

export function toSafeMarkdownText(value: unknown): string {
  return defangText(value).replace(MARKDOWN_PUNCTUATION, "\\$&");
}
