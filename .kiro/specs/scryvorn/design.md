# Design Document — Scryvorn Message-and-URL Scanner MVP

## Overview

Scryvorn is a single-purpose web application that lets a user paste a suspicious message and/or URL and receive a transparent, two-layer forensics assessment: deterministic, rule-based checks first, then AI interpretation of social-engineering patterns. The two layers are combined into a 0–100 Risk_Score and a Severity_Tier rendered as a wax-seal stamp, with itemized evidence split into separate "Verified Checks" and "AI Interpretation" sections. The user can copy or download an Evidence_Report. The app never claims a message or link is definitively safe, retains nothing server-side or in persistent storage, and degrades gracefully when the AI service or optional domain-age lookup is unavailable.

This design covers the MVP only: the message-and-URL scanner. Contract/lease PDF scanning, bank-statement analysis, and subscription-drain detection are explicitly out of scope and appear only as "Coming Soon" roadmap items on the landing page.

### Design Goals

- **Verifiable over decorative.** Every material claim in the UI is backed by quoted text, a URL/domain check output, or a stated rule. The Deterministic_Check_Engine is a set of pure functions so its output is reproducible and testable.
- **Graceful degradation.** The scan remains useful with only deterministic findings if the AI service times out (30 s) or errors, and with no domain-age data if that optional lookup is unconfigured or fails.
- **No persistence, no leakage.** Inputs and results live only in component state for the page session and are never written to a database, file, log, analytics service, or client-side storage.
- **Deployable as committed.** The build succeeds on Cloudflare Pages using only committed files and environment variables; no local-only files or committed secrets are required.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| One scan API route (`/api/scan`) using a standard POST request/response | A single server-side route runs the full pipeline — deterministic checks first, then AI, then combine — and returns one JSON response. The UI shows a simple loading state while the request is in flight. Keeps orchestration server-side without splitting it to the client. |
| Edge Runtime on the scan route | Required for Cloudflare Pages (`@cloudflare/next-on-pages`); `fetch` is available for the AI and domain-age calls. A standard edge POST handler with no special configuration. |
| Deterministic checks are pure functions; only the optional domain-age lookup is async | Makes the deterministic layer deterministic, idempotent, and property-testable; isolates the only network dependency. |
| Risk_Score is a pure function of findings; Severity_Tier is derived from the score (never the reverse) | Satisfies "score derived from findings, not manually adjusted to fit a tier." |
| AI returns structured JSON findings + recommended steps, not free prose | Lets findings feed the same scoring and rendering pipeline as deterministic findings and keeps evidence itemized. |
| Single page (`/`) serves as both scan page and landing page (scanner + advisory disclaimer + roadmap) | Minimal, production-ready for a single-purpose tool; satisfies both "scan page" and "landing page" requirements without route duplication. |

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (app/, components/)                         │
│  Next.js App Router + React client components + Tailwind │
│  Autumn Lantern & Enchanted Casebook theme                │
└───────────────▲──────────────────────┬───────────────────┘
                │ JSON response        │ POST { input }
┌───────────────┴──────────────────────▼───────────────────┐
│  API Layer  app/api/scan/route.ts  (Edge Runtime)         │
│  Validates input → orchestrates pipeline → returns result │
└───────────────▲──────────────────────┬───────────────────┘
                │                      │
   ┌────────────┴──────────┐  ┌─────────┴──────────────┐
   │ /lib/checks/          │  │ /lib/ai/               │
   │ Deterministic engine  │  │ AI interpretation      │
   │ (pure) + domain-age   │  │ (external LLM, 30s TO) │
   │ (optional, async)     │  │                        │
   └────────────┬──────────┘  └─────────┬──────────────┘
                │                        │
   ┌────────────┴──────┐  ┌──────────────┴─────────────┐
   │ /data/*.json       │  │ env vars (AI_API_KEY, ...)  │
   │ versioned lists    │  │ .env.local (gitignored)     │
   └───────────────────┘  └─────────────────────────────┘
                │
   ┌────────────▼─────────────────────────────────────────┐
   │ /lib/scoring/ + /lib/report/  (pure)                   │
   │ Risk_Score + Severity_Tier + Evidence_Report builder   │
   └───────────────────────────────────────────────────────┘
```

### Pipeline Sequence

```mermaid
sequenceDiagram
    participant U as Browser (scan page)
    participant A as /api/scan (Edge)
    participant D as Deterministic Engine (pure)
    participant AI as AI Engine (external LLM)
    participant S as Scoring + Report

    U->>A: POST { input }
    A->>A: validate (non-empty, ≤10000 chars)
    Note over U: show simple loading indicator
    A->>D: run all deterministic checks (in order)
    D-->>A: deterministic findings (+ domain-age if configured)
    A->>AI: interpret(input, deterministic summary)
    alt AI succeeds < 30s
        AI-->>A: structured findings + steps
    else AI timeout/error
        AI-->>A: unavailable (timeout | error)
    end
    A->>S: combine deterministic (+ ai if available)
    S-->>A: riskScore, severityTier, recommendedSteps
    A-->>U: 200 JSON ScanResult (full result)
    Note over U: hide loading; render Verified Checks, AI Interpretation, Wax Seal, Report export
```

### Tech Stack

- **Framework:** Next.js App Router, TypeScript strict mode.
- **Styling:** Tailwind CSS with the Scryvorn theme tokens.
- **Runtime:** Edge Runtime for `/api/scan`; static/client rendering for the page.
- **AI:** OpenAI-compatible Chat Completions API (base URL, key, model configurable), called with `fetch` + `AbortController` (30 s timeout).
- **Domain-age (optional):** configurable HTTP lookup service returning registration age in days.
- **Deployment:** Cloudflare Pages via `@cloudflare/next-on-pages`.
- **Testing:** Vitest (unit/integration), React Testing Library (components), `fast-check` (property-based tests).

### Deployment Topology

> **Required decision before Task 6: deployment target.** Netlify is now the current deployment target. This design, Req 11.1, steering `tech.md`, Task 6.1 (Edge Runtime route), `package.json` (`pages:build`, `@cloudflare/next-on-pages`), and `wrangler.toml` still describe Cloudflare Pages. Before Task 6, these must be reconciled with approval: the route runtime (Netlify Functions/Node or Edge), how server environment variables are read, the build command, and the Req 11.1 compliance criteria. Task 5 makes no deployment, runtime, or package changes. The Cloudflare text below is kept until that decision is recorded.

The scan route is the only server-side surface and runs on the Edge Runtime; the rest of the app is statically prerendered or client-rendered. Secrets (`AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`, optional `DOMAIN_AGE_API_URL`, `DOMAIN_AGE_API_KEY`) are bound as Cloudflare environment variables / secrets and loaded from `.env.local` in development. No database, auth, analytics, or server-side logging of user data is present. Full WCAG validation, responsive checks, and Cloudflare build success are covered in the Testing Strategy.

## Components and Interfaces

### Module Map

```
app/
  layout.tsx                  root layout, theme, fonts, advisory disclaimer shell
  page.tsx                    single page: scanner + roadmap section
  api/scan/route.ts           POST handler (Edge Runtime), pipeline orchestration
components/
  theme/
    Header.tsx                Moonlit Midnight header w/ decorative crescent-moon/bat motif (aria-hidden)
    SpiderwebCorners.tsx      decorative SVG corner accents (aria-hidden, pointer-events:none)
  scanner/
    ScannerCard.tsx           parchment card wrapper (composes input + samples + controls)
    ScannerInput.tsx          textarea (max 10,000), char counter, submit button
    SampleTrapButtons.tsx     three one-click synthetic sample buttons
    LoadingState.tsx          simple loading indicator shown while the POST is in flight
    VerifiedChecks.tsx        renders only deterministic findings
    AiInterpretation.tsx      renders only AI findings / "AI analysis unavailable" notice
    WaxSealVerdict.tsx        wax-seal stamp (tier + score, color per tier)
    EvidenceReportExport.tsx  Copy + Download (.md) buttons with disabled/error states
    AdvisoryDisclaimer.tsx    advisory disclaimer banner
  roadmap/
    RoadmapSection.tsx        "Coming Soon — Product Roadmap" + two roadmap items
lib/
  types.ts                    shared types (ScanResult, Finding, SeverityTier, ...)
  constants.ts                theme palette, input limits, scoring weights
  checks/
    types.ts                  DeterministicFinding, CheckName, DeterministicResult
    urlExtractor.ts           extractUrls(text): string[]
    httpsValidator.ts         checkHttps(url): DeterministicFinding
    shortenerDetector.ts      detectShortener(url, list): DeterministicFinding | null
    domainHeuristic.ts        domainHeuristic(url, tldList, legitimateDomains?: KnownLegitimateDomainList): DeterministicFinding[]
    scamTriggerDetector.ts    detectScamTriggers(text, triggerSet): DeterministicFinding[]
    domainAgeLookup.ts        lookupDomainAge(domain, service?): Promise<DeterministicFinding|null>
    deterministicEngine.ts    runDeterministicChecks(input, opts?): Promise<DeterministicResult>
  ai/
    types.ts                  AiFinding, AiOutcome
    prompt.ts                 buildAiPrompt(input, deterministicSummary): string
    aiInterpretation.ts       runAiInterpretation(input, summary, opts?: {timeoutMs?: number}): Promise<AiOutcome> (server-side only)
  scoring/
    riskScore.ts              computeRiskScore(det, ai): number; severityTierForScore(score)
    assessment.ts             assessScan(det: DeterministicResult, ai: AiOutcome): ScanAssessment (shared completion rule)
  report/
    evidenceReport.ts         buildEvidenceReport(result): string; reportFilename(timestamp): string
    safeMarkdown.ts           toSafeMarkdownText(untrusted): string (escape + defang)
  samples/
    sampleTraps.ts            three synthetic sample strings (fictional data only)
data/
  shorteners.json            versioned URL-shortener domain list (+ source, date)
  elevatedAttentionTlds.json versioned elevated-attention TLD list (+ source, date)
  scamTriggers.json          versioned scam-trigger phrase sets (+ source, date)
.env.example                 required env vars with non-functional placeholders
.env.local                   local secrets (gitignored)
.gitignore                   includes .env.local; keeps .kiro/ tracked
LICENSE                      MIT
```

### Interface Contracts

**Scan API route — `POST /api/scan` (Edge Runtime)**

```ts
// Request
POST /api/scan
Content-Type: application/json
{ "input": string }

// Validation (synchronous):
//   - 400 JSON { "error": "input_required" | "input_too_long" } if empty-after-trim or length > 10_000

// Success response: application/json, single JSON body
//   200 ScanResult  (full result; see Data Models)
//   400 { "error": "input_required" | "input_too_long" }
```

Client-side validation prevents submitting empty input (no call is made); the server re-validates as defense-in-depth. The client sends one `POST` with the input and renders the result from the single JSON response. While the request is in flight the UI shows a simple loading indicator; on the `200` response the Verified Checks, AI Interpretation, Wax-Seal verdict, and report-export controls are rendered and the Copy/Download buttons become enabled. On a `400` the inline validation message is shown; on any other non-200 response a generic error state is shown.

**Deterministic engine**

```ts
// Checks that must all finish for a run to be "complete". Domain age is optional.
export type RequiredCheckName = Exclude<CheckName, "domain_age">;
export type DeterministicRunStatus = "complete" | "incomplete";

export interface DeterministicResult {
  findings: DeterministicFinding[];
  status: DeterministicRunStatus;        // "incomplete" after an unexpected internal check failure
  incompleteChecks: RequiredCheckName[]; // unfinished required checks, pipeline order; [] iff complete
  domainAgeAvailable: boolean;           // false when lookup unconfigured/failed, or skipped (incomplete run)
  lookalikeCheckActive: boolean;         // a non-empty legitimate-domain list was injected (configuration, not execution)
}

// Orchestrates pure checks in order; the only async step is the optional domain-age lookup.
export async function runDeterministicChecks(
  input: string,
  opts?: {
    domainAgeLookup?: (domain: string) => Promise<number | null>;
    legitimateDomains?: KnownLegitimateDomainList; // injected; absent/empty => lookalike check inactive
    domainAgeTimeoutMs?: number;                   // per-lookup wait limit; default 5000 (DOMAIN_AGE_TIMEOUT_MS)
  }
): Promise<DeterministicResult>;
```

**Completion status.** Required checks are `url_extraction`, `https_status`, `shortener`, `domain_heuristic`, and `scam_triggers`. A required check counts as finished only after it has run over the whole input (per-URL checks: after the last URL). If an unexpected internal failure interrupts them, the engine keeps the findings collected so far, sets `status: "incomplete"`, and lists the unfinished required checks in `incompleteChecks`. No exception text or user input is recorded in this metadata. When a run is incomplete, the optional domain-age stage is skipped (no lookup, no note, `domainAgeAvailable: false`). Individual checks do not swallow unexpected internal errors (they still return no finding for unparseable URLs), so a failure surfaces as an incomplete run instead of a normal-looking empty result. Two expected states are NOT failures and leave `status: "complete"`: an absent or empty legitimate-domain list (lookalike check inactive), and an unconfigured or failing optional domain-age lookup (informational fallback note).

**Downstream requirement (Req 6.9).** Scoring, report, API, and UI tasks must not present an incomplete deterministic run as a completed assessment. `assessScan` (see Scoring) gives an incomplete run `riskScore`, `severityTier`, and `waxSealColor` of `null`; no score is computed from partial findings and no tier is substituted. The Evidence_Report and UI must state "Assessment incomplete — no overall risk score or tier assigned.", name the unfinished checks, and keep the collected evidence.

**Lookalike detection and the known-legitimate-domain list.** No production reference list of legitimate domains exists, and none is invented or bundled. `domainHeuristic(url, tldList, legitimateDomains?)` takes the list as an optional injected argument. With an empty or absent list, lookalike checking is INACTIVE and produces no lookalike findings; this means the check was not performed, NOT that the domain passed. A reviewed, versioned list (same shape as the other `/data` files: `version`, `source`, `date`, `domains`) can be supplied later and injected by the scan route. Matching compares the parsed hostname's last two labels only (never path or query substrings), using conservative rules (character substitution, single omission, typosquatting). Low-confidence matches are labeled "Needs manual verification" and set `needsManualVerification=true`; the finding never asserts impersonation. The engine performs no network requests by default.

`lookalikeCheckActive` reports configuration, not execution. `true` means a non-empty list was injected, so lookalike comparison was enabled for the run; it does not prove the comparison ran for every URL. That holds only when `incompleteChecks` does not include `domain_heuristic`. `false` means lookalike checking was not performed.

**Not ready for general production activation.** The comparison treats a hostname's last two labels as its registrable domain and uses no Public Suffix List, so it mishandles multi-label public suffixes such as `co.uk`. With `paypal.co.uk` listed, `paypa1.co.uk` is missed. With `paypal.com` listed, the real `paypal.co.uk` gets a misleading low-confidence finding. The public-suffix handling must be reviewed and corrected before any production reference list is enabled. Until then, Req 4.4 and 4.12 are only partially satisfied.

The engine calls the pure check functions (`extractUrls`, `checkHttps`, `detectShortener`, `domainHeuristic`, `detectScamTriggers`) in a fixed order, then the optional `domainAgeLookup`. On any lookup failure/unconfiguration it appends an informational "domain-age data unavailable" finding rather than aborting.

**Domain-age lookup timing.** Lookups run sequentially, once per unique parsed hostname in first-seen order. Each lookup waits at most `domainAgeTimeoutMs` (default 5,000 ms, `DOMAIN_AGE_TIMEOUT_MS` in `lib/checks/domainAgeLookup.ts`) and is then treated as failed. The timeout limits waiting only: it does not cancel the injected service, which may keep running in the background, because the lookup function signature has no abort signal. There is currently no overall time budget and no limit on how many hostnames are looked up, so total time grows with the number of unique hostnames in the input. **Before a production domain-age service is enabled**, an overall lookup budget or a bounded lookup policy (for example, a hostname-count limit) must be designed and approved. No such limit is set yet.

**AI engine**

```ts
export type AiOutcome =
  | { unavailable: true; reason: "timeout" | "error" }
  | { unavailable: false; findings: AiFinding[]; recommendedSteps: string[] };

export async function runAiInterpretation(
  input: string,
  deterministicSummary: string,
  opts?: { timeoutMs?: number } // default AI_TIMEOUT_MS (30,000 ms)
): Promise<AiOutcome>;

export function buildAiPrompt(input: string, deterministicSummary: string): string;
```

**Prompt.** The prompt instructs the model to: return exactly one JSON object `{ findings: [{category,label,evidence,severity}], recommendedSteps: [] }` with no markdown, code fences, or extra keys; only report observations supported by the submitted message (empty array if none); never claim the input, sender, or any link is safe and never use "Verified Safe"; use `severity` only as confidence (`low|medium|high`), not proof of fraud; and never fetch, visit, or verify URLs. Both arguments are untrusted: each is embedded after the rules as a JSON string literal (`JSON.stringify`), so quotes and line breaks are escaped, and the model is told to ignore any instructions inside them. The whole prompt is sent as a single `user` message.

**Timeout.** `timeoutMs` is an optional numeric override (finite and > 0; otherwise the outcome is `error` with no request). One timer covers both the request and reading the response body. When it fires, the request is aborted through `AbortController` and the outcome is `reason: "timeout"`; every other failure is `reason: "error"`. The timer is cleared on every exit path.

**Configuration and endpoint.** Server-side only, by convention: only the scan route imports `lib/ai/aiInterpretation.ts`. It reads `AI_API_KEY`, `AI_API_BASE_URL`, and `AI_MODEL` from `process.env` at call time (they are not `NEXT_PUBLIC_` variables, so they are never inlined into client bundles), and it returns `error` without reading them if called where `window` exists. If any is missing or blank, it returns `error` without a request. The endpoint is `AI_API_BASE_URL` with trailing slashes removed plus `/chat/completions`, so the base URL includes the version path (`https://api.example.com/v1` → `https://api.example.com/v1/chat/completions`). The base URL must be `https`, or `http` only for `localhost`, `127.0.0.1`, or `[::1]`, with no query, fragment, or credentials; otherwise it is treated as missing configuration.

**Response validation.** A non-2xx status, a body that is not JSON, or an envelope without a string `choices[0].message.content` is `error`. The content must parse as JSON with exactly the keys `findings` and `recommendedSteps`. Each finding must have exactly `category`, `label`, `evidence` (non-blank strings) and `severity` (exactly `"low"`, `"medium"`, or `"high"`). `recommendedSteps` must be an array of non-blank strings. Anything else, including code-fenced JSON, is `error`: malformed findings are rejected, never coerced, and one invalid finding rejects the whole result. Valid findings get `id: "ai:<index>"`, `source: "ai"`, and `weight` from `SCORING_WEIGHTS.ai[severity]`; the engine does not compute the Risk_Score.

**No leakage.** Unavailable outcomes are exactly `{ unavailable: true, reason }`. They never include credentials, provider error text, or submitted content, and the engine logs nothing.

**Scoring**

```ts
export function computeRiskScore(det: DeterministicFinding[], ai: AiFinding[]): number; // 0..100
export function severityTierForScore(score: number): { tier: SeverityTier; color: string };
```

`computeRiskScore` is a pure, findings-only calculation. It sums the `weight` already assigned to each finding by the trusted internal producers (the deterministic checks and the AI engine), which take their weights from `SCORING_WEIGHTS`. It applies `scam_trigger_max_total` (36) only to deterministic findings whose `check` is `"scam_triggers"`, never to AI category strings, then clamps to `[0,100]` and rounds. It throws `InvalidFindingWeightError` (a `RangeError`) for any non-finite or negative weight, rather than letting a bad weight lower or corrupt the score. `severityTierForScore` maps an integer score in `[0,100]` to a tier and wax-seal color (it throws a `RangeError` otherwise). The tier is derived strictly from the score.

**Internal contracts only.** These functions trust the weights on the findings they receive. They are not an API for accepting client-supplied findings or weights: the scan route must generate its own findings by running the engines server-side and must never score findings taken from a request.

**Shared assessment helper.**

```ts
type ScanAssessment = Omit<ScanResult, "timestamp" | "inputType">; // distributive over the union
export function assessScan(det: DeterministicResult, ai: AiOutcome): ScanAssessment;
```

`assessScan` is the single place that applies the completion rule (Req 6.9). Route and UI code must use it instead of rebuilding the rule:
- The run counts as complete only if `det.status === "complete"` and `det.incompleteChecks` is empty. Then `riskScore = computeRiskScore(...)`, and `severityTier` and `waxSealColor` come from `severityTierForScore`.
- Otherwise the result is incomplete. `riskScore`, `severityTier`, and `waxSealColor` are `null`, `incompleteChecks` lists the unfinished checks, and all collected findings are kept. No higher tier is substituted and no score is manufactured.
- If AI is unavailable, `aiFindings` is `[]` and `aiUnavailableReason` is set. The score then uses deterministic findings alone (Req 6.8).
- `recommendedSteps` are the AI's steps when AI is available and returned at least one. Otherwise they are `FALLBACK_VERIFICATION_STEPS`.
- `lookalikeCheckActive`, `domainAgeAvailable`, and `disclaimer` (`ADVISORY_DISCLAIMER`) are filled in. The route adds `timestamp` and `inputType`.

**Report**

```ts
export function buildEvidenceReport(result: ScanResult): string; // Markdown
export function reportFilename(timestamp: string): string; // scryvorn-report-YYYYMMDD-HHmmss.md (UTC)
```

**Report sections, in order.** "Assessment status and coverage", "Scored deterministic findings", "Informational context", "Checks not performed / unavailable", "AI interpretation", "Recommended verification steps", "Advisory disclaimer". The heading "Verified Checks" is not used in the report.
- **Assessment status and coverage.** Shows the UTC scan time, input type, and deterministic status.
  - Complete: the Risk_Score, labeled as an uncalibrated heuristic score (not a probability or fraud verdict), and the Severity_Tier.
  - Incomplete: "Assessment incomplete — no overall risk score or tier assigned.", the unfinished required checks, and a note that the collected evidence is still listed.
  - Lookalike configuration: inactive → "Lookalike checking was not performed because no reviewed reference list is configured. This is not a passed check."; active → configured with a reference list, which does not by itself prove the check ran for every URL.
- **Scored deterministic findings.** Deterministic findings with weight > 0.
- **Informational context.** Weight-0 deterministic findings other than domain-age unavailability, such as HTTPS status and elevated-attention TLD matches.
- **Checks not performed / unavailable.** Inactive lookalike checking, domain-age unavailability notes, required checks interrupted by an internal failure, and unavailable AI analysis.
- **AI interpretation.** If AI is unavailable, "AI analysis unavailable"; any supplied `aiFindings` are ignored. Otherwise the AI findings, labeled as model interpretation with confidence, not verified facts.
- **Recommended verification steps.** Labeled as recommendations for the reader to carry out. The report states that Scryvorn did not visit, open, or confirm any link or destination. If `recommendedSteps` is empty, `FALLBACK_VERIFICATION_STEPS` are used.
- **Empty sections.** An empty section says so, and adds that this is not proof of safety where relevant.

**Safe Markdown output.** Finding labels, evidence, matched text, URLs, references, AI text, steps, and the disclaimer are all untrusted report content. `toSafeMarkdownText` transforms only the output; the findings in memory are not changed. It applies these steps in order:
1. Collapses line breaks to spaces.
2. Replaces control and bidirectional-override characters with U+FFFD.
3. Defangs URL schemes (`https://` → `hxxps://`, `http://` → `hxxp://`, `://` → `[://]` for other schemes).
4. Defangs domain dots (an ASCII or full-width/ideographic dot between a name character and a letter becomes `[.]`).
5. Backslash-escapes Markdown and HTML punctuation (``\ ` * _ { } [ ] ( ) # + - . ! | < > ~ &``).

As a result the report contains no raw HTML, Markdown links, images, code fences, or autolinks taken from untrusted content. Some viewers auto-link text heuristically, so the absence of automatic linking cannot be guaranteed in every Markdown viewer.

**Timestamps.** The scan timestamp must be ISO 8601 `YYYY-MM-DDTHH:mm[:ss[.fraction]]` with `Z` or a numeric offset (`±HH:MM` or `±HHMM`), and must be a real calendar date and time. Otherwise `buildEvidenceReport` and `reportFilename` throw `InvalidTimestampError`. The error message does not include the value, and the current time is never substituted. The report shows the time converted to UTC, and the filename uses UTC: `scryvorn-report-YYYYMMDD-HHmmss.md`.

**Score limitations (uncalibrated, for this milestone).** Apart from the scam-trigger cap, deterministic contributions are additive. AI contributions are additive. Overlap between the two engines (for example, deterministic and AI `credential_request`) is not deduplicated. AI findings alone can currently reach "TRAP DETECTED" (four high-confidence findings = 100), and repeated distinct shortened URLs can too (5 × 15 = 75). The Risk_Score is an uncalibrated heuristic: not a probability, a verified fraud verdict, or a validated confidence estimate. No further caps are set yet.

### UI Components

| Component | Responsibility | Key requirements |
|---|---|---|
| `Header` | Moonlit Midnight (#0D1117) header with decorative crescent moon/bat motif behind header text | Motif is `aria-hidden` and low-opacity so text stays distinguishable (Req 2.1) |
| `SpiderwebCorners` | Decorative geometric spiderweb SVG corner accents on the scanner card | `aria-hidden`, `pointer-events:none`, positioned to not overlap input/results (Req 2.4) |
| `ScannerCard` | Warm Aged Parchment (#F8F3E6) card with dark ink (#1A1614) text; composes input, samples, progress, results, export | Req 2.2 |
| `ScannerInput` | `<textarea>` capped at 10,000 chars, live char counter, Pumpkin Orange (#FF5A1F) submit button; client-side empty/length validation with inline messages | Req 1.1, 1.5, 1.6, 2.3 |
| `SampleTrapButtons` | Three buttons: "Fake Remote Job DM", "Phishing Payment Link", "Legitimate Bank Alert"; clicking replaces textarea content | Req 1.2, 1.3 |
| `LoadingState` | Simple visible loading indicator shown while the scan POST is in flight; clears on response (success/error/unavailable handled by the result render) | Req 2.8 |
| `VerifiedChecks` | Renders only deterministic findings, under a heading identifying evidence as deterministic | Req 7.1, 7.3 |
| `AiInterpretation` | Renders only AI findings under a heading identifying evidence as AI-generated; shows explicit "AI analysis unavailable" notice (never fabricated findings) when AI is down | Req 7.2, 7.3, 7.4, 7.5 |
| `WaxSealVerdict` | Wax-seal stamp showing Severity_Tier + Risk_Score, colored per tier | Req 6.2–6.4, 6.7 |
| `EvidenceReportExport` | "Copy Evidence Report" and "Download Report (.md)" buttons; disabled until a scan completes; error notice on failure preserving the report for retry | Req 9.1, 9.2, 9.5, 9.6 |
| `AdvisoryDisclaimer` | Advisory disclaimer stating output is risk signals/verification guidance, not financial/legal/law-enforcement advice | Req 8.1 |
| `RoadmapSection` | "Coming Soon — Product Roadmap" heading with "Contract & Lease PDF X-Ray" and "Subscription Drain Hunter" items | Req 10.1, 10.2 (no implementation, Req 10.3) |

### Theme and Accessibility

Theme palette (`lib/constants.ts`):

| Token | Hex | Used for |
|---|---|---|
| Moonlit Midnight | #0D1117 | Header background; light text on it |
| Warm Aged Parchment | #F8F3E6 | Scanner card background |
| Dark Ink | #1A1614 | Body text on parchment; small text on Pumpkin Orange / gold / emerald seals |
| Pumpkin Orange | #FF5A1F | Primary submit button |
| Crimson Wax | #DC2626 | "TRAP DETECTED" seal |
| Candlelight Gold | #D97706 | "Caution — verify before acting" seal |
| Potion Emerald | #059669 | "Low risk — still verify independently" seal |

Contrast strategy (computed ratios; full WCAG validation requires manual testing with assistive technology):
- Dark ink on parchment ≈ 15:1 — passes AAA.
- Header: light cream/parchment text on Moonlit Midnight ≈ 15:1.
- Submit button: bold white label ≥ 18.66 px on Pumpkin Orange ≈ 3:1 (meets AA large-text); small text on the button uses dark ink (≈ 5.6:1, meets AA normal-text).
- Seals: white text on Crimson Wax (≈ 4.6:1, AA normal) for the TRAP seal; dark ink text on Candlelight Gold and Potion Emerald (≈ 5.6:1, AA normal) for the other two seals. Seal text is large/bold.

Decorative elements (moon/bat motif, spiderweb corners) are purely decorative: `aria-hidden="true"`, `pointer-events:none`, and rendered behind or away from interactive/result areas. All primary controls are real `<button>`/`<textarea>` elements with visible focus rings and full keyboard operability. The layout uses Tailwind responsive utilities to avoid horizontal scrolling at 360 px / 768 px / 1024 px.

## Data Models

### Core Types

```ts
// lib/types.ts
export type SeverityTier =
  | "TRAP DETECTED"
  | "Caution — verify before acting"
  | "Low risk — still verify independently";

export type InputType = "message" | "url" | "mixed";

interface ScanResultBase {
  timestamp: string;                 // ISO 8601 with Z or a numeric offset
  inputType: InputType;              // derived from whether URLs were found
  deterministicFindings: DeterministicFinding[];
  aiFindings: AiFinding[];           // always [] when aiAvailable is false
  recommendedSteps: string[];        // AI steps, or FALLBACK_VERIFICATION_STEPS
  aiAvailable: boolean;
  aiUnavailableReason?: "timeout" | "error";
  lookalikeCheckActive: boolean;     // configuration, not execution
  domainAgeAvailable: boolean;
  disclaimer: string;                // advisory disclaimer text
}

// Discriminated on deterministicStatus (Req 6.9).
export interface CompleteScanResult extends ScanResultBase {
  deterministicStatus: "complete";
  incompleteChecks: [];
  riskScore: number;                 // 0..100 integer, uncalibrated heuristic
  severityTier: SeverityTier;
  waxSealColor: string;              // hex for the seal
}

export interface IncompleteScanResult extends ScanResultBase {
  deterministicStatus: "incomplete";
  incompleteChecks: CheckName[];     // unfinished required checks
  riskScore: null;                   // no score is manufactured
  severityTier: null;                // no tier is substituted
  waxSealColor: null;
}

export type ScanResult = CompleteScanResult | IncompleteScanResult;
```

```ts
// lib/checks/types.ts
export type CheckName =
  | "url_extraction" | "https_status" | "shortener"
  | "domain_heuristic" | "scam_triggers" | "domain_age";

export interface DeterministicFinding {
  id: string;
  source: "deterministic";
  check: CheckName;
  category: string;                  // e.g. "https_status" | "shortener" | "elevated_attention_tld" | "lookalike" | "upfront_payment" | "domain_age_unavailable"
  label: string;                     // check-type label, human readable
  evidence: string;                  // outcome description
  url?: string;                      // affected URL (URL-based checks)
  matchedText?: string;             // matched scam phrase (scam-trigger checks)
  suspectedLegitDomain?: string;    // for lookalike findings
  needsManualVerification?: boolean; // true for low-confidence lookalikes
  reference?: string;               // list version cited (shortener/TLD findings)
  severity: "info" | "low" | "medium" | "high";
  weight: number;                    // risk contribution; 0 = informational
}
```

```ts
// lib/ai/types.ts
export interface AiFinding {
  id: string;
  source: "ai";
  category: string;
  label: string;
  evidence: string;
  severity: "low" | "medium" | "high";
  weight: number;                    // mapped from severity for scoring
}
```

### Versioned Reference Data

All three lists are committed, reviewable JSON files with a `version`, `source`, and `date` so findings can cite them (Req 4.10, 4.11).

`data/shorteners.json`: the committed file in `/data` is authoritative for its contents (shape: `version`, `source`, `date`, `domains`).

```jsonc
// data/elevatedAttentionTlds.json
// Note: TLD matches are informational context, not a high-risk verdict.
{
  "version": "2026.01",
  "source": "https://example.org/elevated-attention-tld-list",
  "date": "2026-01-01",
  "tlds": [".xyz", ".top", ".click", ".country", ".stream", ".live", ".rest", ".cyou"]
}
```

`data/scamTriggers.json`: the committed file in `/data` is authoritative for its categories and phrases. Any phrase lists shown elsewhere in this spec are illustrative only.

### Scoring Configuration

`lib/constants.ts` centralizes tunable weights so the score remains a pure function of findings:

```ts
export const SCORING_WEIGHTS = {
  deterministic: {
    shortener: 15,
    elevated_attention_tld: 0,  // informational context only (Req 4.4); never adds risk
    lookalike_high: 20,
    lookalike_low: 10,
    scam_trigger_each: 12,
    scam_trigger_max_total: 36, // caps total trigger contribution
    domain_age_young_days: 90,  // younger than this adds risk
    domain_age_young: 10,
    https_status: 0,            // informational only (Req 4.8)
    domain_age_unavailable: 0,  // informational note only
  },
  ai: { high: 25, medium: 15, low: 8 },
} as const;

export const SEVERITY_TIERS = [
  { min: 70, max: 100, tier: "TRAP DETECTED", color: "#DC2626" },
  { min: 40, max: 69, tier: "Caution — verify before acting", color: "#D97706" },
  { min: 0, max: 39, tier: "Low risk — still verify independently", color: "#059669" },
] as const;

export const INPUT_MAX_CHARS = 10_000;
export const AI_TIMEOUT_MS = 30_000;
export const ADVISORY_DISCLAIMER =
  "Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice. Always verify independently.";

// Reviewed fallback steps: used when AI is unavailable or returns no steps (Req 9.11).
export const FALLBACK_VERIFICATION_STEPS = [
  "Verify the sender through an independently obtained contact method.",
  "Open the organization's official app or independently locate its official website instead of using the submitted link.",
  "Do not share passwords, one-time codes, or recovery phrases.",
  "Pause before sending money or acting on urgent requests.",
] as const;
```

**Decision: elevated-attention TLDs are informational only.** Elevated-attention TLD matches are shown as informational context requiring review. They carry weight 0, do not change the Risk_Score, and cannot by themselves escalate the Severity_Tier (Req 4.13). Informational findings (weight 0: `https_status`, `elevated_attention_tld`, `domain_age_unavailable`) are kept distinct from scored risk contributions.

`computeRiskScore` sums these weights (capping the total scam-trigger contribution at `scam_trigger_max_total`), clamps to `[0,100]`, and rounds to an integer. Because the weights and clamp are fixed, identical findings always yield an identical score and the tier is derived purely from that score.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

For Scryvorn's pure logic layer, a small, high-value set of property-based tests covers the most error-prone deterministic logic: URL extraction, the HTTPS-informational rule, shortener detection, scam-trigger detection, the risk-score/tier boundary mapping, and evidence-report generation when AI is unavailable. UI rendering, the external AI call, the optional domain-age lookup, input validation, WCAG contrast, and deployment compliance are handled with example-based, integration, and smoke tests (see Testing Strategy). External calls are abstracted behind injectable interfaces so the report-generation and graceful-degradation logic can be property-tested with deterministic mocks/fakes.

### Property 1: URL extraction recovers all embedded URLs

*For any* message text and any set of valid URLs embedded within it, the URL_Extractor returns exactly those URLs (no omissions, no spurious additions).

**Validates: Requirements 4.1**

### Property 2: HTTPS status is informational and never contributes to the risk score

*For any* extracted URL, the HTTPS_Validator records HTTPS usage if and only if the URL's scheme is `https`, and that finding always carries weight 0, so HTTPS presence or absence alone never contributes to the Risk_Score.

**Validates: Requirements 4.2, 4.8**

### Property 3: URL-shortener detection matches the list

*For any* extracted URL and any committed shortener list, the Shortener_Detector flags the URL as shortened if and only if the URL's registrable domain is present in the list, and does not flag it otherwise.

**Validates: Requirements 4.3**

### Property 4: Scam-trigger detection yields one finding per matched category and none otherwise

*For any* Scanner_Input and committed trigger phrase sets, the Scam_Trigger_Detector produces exactly one finding for each trigger category whose phrase set matches the input (distinct categories, never duplicated), and produces zero findings when no category's phrase set matches.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10**

### Property 5: Risk-score boundaries map to the correct severity tier

*For any* integer Risk_Score in [0, 100], the Severity_Tier and wax-seal color are uniquely determined by the score's range; specifically, the boundary values 0 and 39 map to "Low risk — still verify independently" (Potion Emerald), 40 and 69 map to "Caution — verify before acting" (Candlelight Gold), and 70 and 100 map to "TRAP DETECTED" (Crimson Wax). The score is a pure function of the findings (identical findings yield an identical score), and the tier always follows from the score, never the reverse.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 6: Evidence report is complete and timestamped when AI is unavailable

*For any* scan result where the AI_Interpretation_Engine is unavailable, the generated Evidence_Report contains the scan timestamp, input type, Risk_Score (computed from deterministic findings alone), Severity_Tier, all deterministic findings, an explicit "AI analysis unavailable" notice, no fabricated AI findings, recommended verification steps, and the advisory disclaimer; and the download filename includes the scan timestamp.

**Validates: Requirements 6.8, 9.2, 9.4, 7.5**

## Error Handling

| Condition | Handling | Requirement |
|---|---|---|
| Empty or whitespace-only input | Client blocks submission and shows an inline "input required" message next to the textarea; content is retained; no scan runs. Server also returns 400 `input_required` as defense-in-depth. | 1.5 |
| Input exceeds 10,000 characters | Inline "maximum input length exceeded" message next to the textarea; content retained; no scan. | 1.6 |
| Malformed/unparseable URL in input | The URL_Extractor skips unparseable tokens; no crash; valid URLs still processed. | 4.1 |
| AI timeout (>30 s) | `AbortController` aborts the request; the AI engine returns `{ unavailable, reason: "timeout" }`; scan completes with deterministic results and an "AI analysis unavailable" notice. | 3.4 |
| AI returns an error | Same unavailable path (`reason: "error"`); deterministic findings preserved, no rollback. | 3.4 |
| AI returns malformed JSON | Treated as an AI error (unavailable path); deterministic findings stand. | 3.4 |
| AI returns a non-2xx status, an invalid envelope, or content not matching the exact finding/steps shape | Treated as an AI error (unavailable path); findings are never coerced or defaulted. | 3.4, 7.5 |
| AI configuration missing or unusable | Returns the error outcome without making a request; the scan continues with deterministic results. | 3.4, 3.7 |
| Domain-age lookup unconfigured | The lookup step is skipped entirely; an informational "domain-age data unavailable" finding is appended. | 4.6, 4.7 |
| Domain-age lookup fails (timeout/error/unreachable) | Treated as unavailable; absence noted; scan completes. The timeout stops waiting but does not cancel the injected service. | 4.7 |
| Finding with a non-finite or negative weight | `computeRiskScore` throws `InvalidFindingWeightError`. This is an internal-contract violation, never silently scored; the route returns its sanitized generic error. | 6.1, 6.5 |
| Scan timestamp invalid or without `Z`/offset | `buildEvidenceReport` / `reportFilename` throw `InvalidTimestampError` (message excludes the value); the current time is never substituted. | 9.10 |
| Unexpected internal failure in a required deterministic check | Engine keeps findings collected so far and returns `status: "incomplete"` with `incompleteChecks` (check names only, no exception text or user input); the optional domain-age stage is skipped. Downstream layers must not present the result as a completed assessment or as "Low risk — still verify independently". | 6.9 |
| Copy-to-clipboard fails | UI shows an "export failed" notice; the Evidence_Report is preserved so the user can retry. | 9.6 |
| Download fails | UI shows an "export failed" notice; the Evidence_Report is preserved for retry. | 9.6 |
| Network error on the scan POST | UI shows an error state; no scan result is rendered; the user can retry; no fabricated AI findings. | 2.8 |
| Unexpected server error | A generic, sanitized error response is returned (no user input or results echoed); the UI shows a generic error state. | 8.4, 8.5 |

**No-data-leak invariant:** No error path, log statement, or analytics call may include user-supplied message text, URLs, or scan results. The scan route contains no logging of request bodies; any operational logging uses static, sanitized messages. Inputs and results live only in React component state for the page session and are cleared on navigation/refresh; nothing is written to `localStorage`, IndexedDB, files, databases, or third-party services.

## Testing Strategy

Scryvorn uses a dual approach: property-based tests for universal invariants of the pure logic layer, and example-based/integration/smoke tests for UI, external-service wiring, and deployment compliance.

### fast-check Property Tests (Vitest)

- Library: `fast-check`, run via Vitest. Minimum **100 iterations** per property.
- Scope (small, high-value suite): URL extraction (`extractUrls`), HTTPS informational handling (`checkHttps` weight 0 + no score contribution), shortener detection (`detectShortener`), scam-trigger detection (`detectScamTriggers`), risk-score/tier boundary mapping (`computeRiskScore` + `severityTierForScore` at 0/39/40/69/70/100), and evidence-report generation with AI unavailable (`buildEvidenceReport`).
- External dependencies (AI, domain-age) are abstracted behind injectable interfaces so the report-generation and graceful-degradation logic is property-tested with deterministic mocks/fakes.
- Each property test is tagged with a comment referencing the design property:
  `// Feature: scryvorn, Property N: <property text>`
- Each property is implemented as a **single** `fast-check` property test.

Properties covered (mapped to the Correctness Properties section): Properties 1–6.

Generators should cover edge cases relevant to this suite: URLs with/without scheme, single/many/zero URLs, shortener and non-shortener domains, inputs matching zero/one/many trigger categories, and AI-unavailable outcomes.

### Unit Tests (example-based)

- Specific examples demonstrating correct behavior for each check (e.g., a known phishing sample yields expected findings).
- Edge cases: empty URL set, single URL, many URLs, URL with attributes/port, unicode/IDNA domains, special characters in messages.
- Component tests with React Testing Library: sample buttons replace textarea content; empty submit shows inline validation and does not call the API; the loading indicator appears during the scan and clears on response; Verified Checks and AI Interpretation render the correct findings; Wax-Seal shows the right tier/color/score; Copy/Download are disabled until a scan completes and enabled after; export failure shows a notice and preserves the report; all primary controls are keyboard-reachable and activatable with visible focus.
- The "Legitimate Bank Alert" sample end-to-end (with a mocked AI) asserts a low-risk result, no fabricated AI findings, and independent-verification guidance (Req 1.7).

### Integration Tests

- The scan route (`/api/scan`) exercised with mocked AI and domain-age services: asserts deterministic checks run to completion before AI starts (Req 3.1, 3.3) and the single JSON response is well-formed (full `ScanResult`).
- AI timeout (artificially shortened timeout in tests) and AI error paths assert graceful degradation (Req 3.4) and that the Risk_Score is computed from deterministic findings alone (Req 6.8).
- Domain-age configured (returns an age) enriches findings; unconfigured and failed paths assert the absence note and that the scan completes (Req 4.6, 4.7).
- No-persistence assertion: spying on storage APIs during a full scan confirms no `localStorage`/IndexedDB writes occur and the server route writes no input/result to logs (Req 8.2, 8.4, 8.5).
- Advisory disclaimer and section headings are present; the "Coming Soon" roadmap section and its two item titles render (Req 8.1, 10.1, 10.2).

### Smoke / Static / Compliance Tests

- Data-file schema validation: `data/shorteners.json`, `data/elevatedAttentionTlds.json`, `data/scamTriggers.json` each have `version`, `source`, `date`, and a non-empty list (Req 4.10).
- `.env.example` exists and lists every required env var with clearly-placeholder values (Req 11.5); `.gitignore` includes `.env.local` (Req 11.6); `.kiro/specs`, `.kiro/steering`, `.kiro/hooks` remain tracked (steering).
- No literal secrets in committed source (secret-pattern scan) (Req 11.3); `LICENSE` contains MIT text (Req 11.4).
- No contract-PDF / bank-statement / subscription-drain modules exist; build succeeds without them (Req 10.3).
- Cloudflare Pages build succeeds using only committed files and environment variables (Req 11.1, 11.2) — verified in CI via the `@cloudflare/next-on-pages` build command.

### Manual / Visual Verification

- WCAG AA contrast confirmed with a contrast checker across all theme text/background pairs at the intended text sizes (full WCAG validation requires manual testing with assistive technology and expert review).
- Responsive layout with no horizontal scrolling at 360 px, 768 px, and 1024 px (Req 2.6).
- Keyboard-only operation of all primary controls and visible focus states (Req 2.7).
- Visual theme review: header motif stays behind legible text, spiderweb corners do not overlap input/results, wax-seal stamps render correctly per tier.
