# Implementation Plan: Scryvorn Message-and-URL Scanner MVP

## Overview

Scryvorn is a single-page Next.js application that runs a two-layer forensics pipeline on user-pasted suspicious messages and URLs: deterministic, rule-based checks first, then AI interpretation. The pipeline combines both layers into a 0–100 Risk_Score and a Severity_Tier rendered as a wax-seal stamp, with itemized evidence split into separate "Verified Checks" and "AI Interpretation" sections. The user can copy or download an Evidence_Report. The app degrades gracefully when the AI service or optional domain-age lookup is unavailable, never claims a message is definitively safe, and retains nothing beyond the page session.

The implementation follows the layered architecture from the design: pure deterministic check functions in `/lib/checks/`, AI interpretation in `/lib/ai/`, scoring and report generation in `/lib/scoring/` and `/lib/report/`, a single Node.js-runtime POST route at `/api/scan` (deployed on Netlify as a serverless function), and modular React components with the Autumn Lantern theme. Tasks build incrementally from project setup through core logic, API orchestration, UI components, and final wiring, with property-based tests placed close to each implementation.

## Tasks

- [x] 1. Set up project structure, data files, and compliance configuration
  - [x] 1.1 Initialize Next.js project with TypeScript strict mode and Tailwind CSS
    - Create `package.json` with Next.js, React, TypeScript dependencies
    - Configure `tsconfig.json` with `strict: true`
    - Configure `tailwind.config.ts` with Scryvorn theme color tokens (Moonlit Midnight #0D1117, Warm Aged Parchment #F8F3E6, Dark Ink #1A1614, Pumpkin Orange #FF5A1F, Crimson Wax #DC2626, Candlelight Gold #D97706, Potion Emerald #059669)
    - Set up `postcss.config.ts` for Tailwind
    - _Requirements: 11.1_

  - [x] 1.2 Create versioned reference data files
    - Create `data/shorteners.json` with `version`, `source`, `date`, and `domains` array (bit.ly, tinyurl.com, t.co, goo.gl, ow.ly, is.gd, buff.ly)
    - Create `data/elevatedAttentionTlds.json` with `version`, `source`, `date`, and `tlds` array (.xyz, .top, .click, .country, .stream, .live, .rest, .cyou); TLD matches are informational context, not a high-risk verdict
    - Create `data/scamTriggers.json` with `version`, `source`, `date`, and `categories` array containing six categories (upfront_payment, credential_request, urgency_pressure, off_platform_move, crypto_payment_demand, suspicious_job_offer), each with `id`, `label`, and `phrases`
    - _Requirements: 4.10, 4.11, 5.1–5.6_

  - [x] 1.3 Set up testing framework
    - Install Vitest and `jsdom` only (do not install `@testing-library/react`, `@testing-library/jest-dom`, or `fast-check` until the core scanner works)
    - Create `vitest.config.ts` with jsdom environment and path aliases matching tsconfig
    - Add test scripts to `package.json` (`test`, `test:run`)

  - [x] 1.4 Create deployment and secrets compliance files
    - Create `.env.example` listing `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`, `DOMAIN_AGE_API_URL`, `DOMAIN_AGE_API_KEY` with clearly-placeholder non-functional values
    - Update `.gitignore` to include `.env.local` and keep `.kiro/specs/`, `.kiro/steering/`, `.kiro/hooks/` tracked
    - Verify `LICENSE` contains standard MIT license text
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 2. Create core types and constants
  - [x] 2.1 Create shared TypeScript types
    - Create `lib/types.ts` with `SeverityTier`, `InputType`, `ScanResult` interfaces
    - Create `lib/checks/types.ts` with `CheckName`, `DeterministicFinding`, `DeterministicResult`
    - Create `lib/ai/types.ts` with `AiFinding`, `AiOutcome`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

  - [x] 2.2 Create constants module
    - Create `lib/constants.ts` with theme palette hex values, `INPUT_MAX_CHARS` (10000), `AI_TIMEOUT_MS` (30000), `SCORING_WEIGHTS` (deterministic and AI weights; `SCORING_WEIGHTS` uses `elevated_attention_tld: 0` because TLD matches are informational only), `SEVERITY_TIERS` (three tiers with min/max/color), and `ADVISORY_DISCLAIMER` text
    - _Requirements: 2.1–2.4, 4.8, 6.1–6.5, 8.1_

- [x] 3. Implement deterministic check engine (pure functions)
  - [x] 3.1 Implement URL Extractor
    - Create `lib/checks/urlExtractor.ts` with `extractUrls(text: string): string[]`
    - Extract every URL from message text; skip unparseable tokens gracefully without crashing
    - _Requirements: 4.1_

  - [ ]* 3.2 Write property test for URL extraction
    - **Property 1: URL extraction recovers all embedded URLs**
    - **Validates: Requirements 4.1**

  - [x] 3.3 Implement HTTPS Validator
    - Create `lib/checks/httpsValidator.ts` with `checkHttps(url: string): DeterministicFinding`
    - Record whether URL uses HTTPS scheme; finding always carries `weight: 0` (informational only)
    - _Requirements: 4.2, 4.8_

  - [ ]* 3.4 Write property test for HTTPS informational handling
    - **Property 2: HTTPS status is informational and never contributes to the risk score**
    - **Validates: Requirements 4.2, 4.8**

  - [x] 3.5 Implement Shortener Detector
    - Create `lib/checks/shortenerDetector.ts` with `detectShortener(url: string, list: ShortenerList): DeterministicFinding | null`
    - Flag URLs whose registrable domain is in the shortener list; cite list version in `reference` field
    - _Requirements: 4.3, 4.11_

  - [ ]* 3.6 Write property test for shortener detection
    - **Property 3: URL-shortener detection matches the list**
    - **Validates: Requirements 4.3**

  - [x] 3.7 Implement Domain Heuristic
    - Create `lib/checks/domainHeuristic.ts` with `domainHeuristic(url: string, tldList: ElevatedAttentionTldList, legitimateDomains?: KnownLegitimateDomainList): DeterministicFinding[]`
    - Flag elevated-attention TLDs from the TLD list as informational context (category `elevated_attention_tld`, weight 0), with specific reason in evidence; not evidence of fraud
    - The known-legitimate-domain list is injectable and empty by default; no production list is bundled; with an empty/absent list lookalike checking is inactive (not performed, not "passed")
    - Test lookalike logic with clearly labeled synthetic fixtures only
    - Req 4.4/4.12 remain partially satisfied until a reviewed list is supplied
    - Not ready for general production activation: the last-two-labels base mishandles multi-label public suffixes (e.g. `co.uk`); review and correct this before any production reference list is enabled
    - Flag lookalike domains using conservative similarity rules (character substitution, omission, typosquatting); display suspected legitimate domain and similarity reason
    - Label low-confidence lookalike matches as "Needs manual verification" rather than asserting impersonation
    - Cite list version in `reference` for TLD findings
    - _Requirements: 4.4, 4.12_

  - [x] 3.8 Implement Scam Trigger Detector
    - Create `lib/checks/scamTriggerDetector.ts` with `detectScamTriggers(text: string, triggerSet: ScamTriggerSet): DeterministicFinding[]`
    - Match input against six trigger phrase sets: upfront payment, credential request, urgency pressure, off-platform move, crypto payment demand, suspicious job offer
    - Produce exactly one finding per matched category; include category label and matched phrase text in each finding
    - Deterministic: identical input always produces identical findings
    - Produce zero findings when no category matches
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ]* 3.9 Write property test for scam-trigger detection
    - **Property 4: Scam-trigger detection yields one finding per matched category and none otherwise**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10**

  - [x] 3.10 Implement Domain Age Lookup
    - Create `lib/checks/domainAgeLookup.ts` with `lookupDomainAge(domain: string, service?: DomainAgeService): Promise<DeterministicFinding | null>`
    - Return domain registration age finding when service is configured and succeeds
    - Return null when service is unconfigured or fails (timeout, error, unreachable); engine appends informational note
    - _Requirements: 4.6, 4.7_

  - [x] 3.11 Implement Deterministic Engine orchestrator
    - Create `lib/checks/deterministicEngine.ts` with `runDeterministicChecks(input: string, opts?): Promise<DeterministicResult>`
    - Call pure check functions in fixed order: extractUrls, then per-URL checkHttps/detectShortener/domainHeuristic, then detectScamTriggers, then optional domainAgeLookup
    - Load versioned data files (shorteners.json, elevatedAttentionTlds.json, scamTriggers.json) and pass to check functions
    - Append informational "domain-age data unavailable" finding when lookup is unconfigured or fails
    - Accept an optional injected legitimate-domain list and domain-age lookup in `opts`; perform no network requests by default
    - Return `status` (`"complete"` | `"incomplete"`) and `incompleteChecks`; an unexpected internal failure keeps findings collected so far but marks the run incomplete, with no exception text or user input in the metadata
    - Inactive lookalike checking and an unavailable optional domain-age lookup do not make a run incomplete; `lookalikeCheckActive` reports configuration, not execution
    - Domain-age lookups are sequential with a per-lookup `domainAgeTimeoutMs` (default 5000 ms) that limits waiting but does not cancel the service; an overall budget or bounded lookup policy is required before enabling a production domain-age service
    - Analyze URL structure and metadata only; never fetch, crawl, render, screenshot, or download content from user-supplied URLs
    - _Requirements: 3.1, 4.1, 4.5, 4.6, 4.7, 4.9, 4.10, 4.11_

- [x] 4. Implement AI interpretation engine
  - [x] 4.1 Implement AI prompt builder
    - Create `lib/ai/prompt.ts` with `buildAiPrompt(input: string, deterministicSummary: string): string`
    - Instruct model to return JSON `{ findings: [{category, label, evidence, severity}], recommendedSteps: [] }`
    - Instruct model to only report findings supported by the input (empty array if none)
    - Instruct model to never claim the input is safe or use the phrase "Verified Safe"
    - Instruct model to base `severity` on confidence (`low`, `medium`, `high`)
    - _Requirements: 3.3, 6.6_

  - [x] 4.2 Implement AI interpretation engine with timeout
    - Create `lib/ai/aiInterpretation.ts` with `runAiInterpretation(input: string, deterministicSummary: string, opts?: { timeoutMs?: number }): Promise<AiOutcome>`
    - Use `AbortController` with an optional numeric timeout override (default `AI_TIMEOUT_MS`, 30000 ms) covering both the request and response-body reading; clear the timer on every exit path
    - Call OpenAI-compatible Chat Completions API via `fetch` using `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL` from environment variables
    - Parse structured JSON response; treat malformed JSON as an error
    - Return `{ unavailable: true, reason: "timeout" }` on timeout, `{ unavailable: true, reason: "error" }` on error or malformed response
    - Return `{ unavailable: false, findings, recommendedSteps }` on success
    - _Requirements: 3.3, 3.4, 3.7_

- [x] 5. Implement scoring and evidence report generation
  - [x] 5.1 Implement risk score computation and severity tier mapping
    - Create `lib/scoring/riskScore.ts` with `computeRiskScore(det: DeterministicFinding[], ai: AiFinding[]): number`
    - Sum the weights assigned by the trusted internal finding producers (which take them from `SCORING_WEIGHTS`); cap total scam-trigger contribution at `scam_trigger_max_total` only for deterministic findings whose `check` is `scam_triggers`
    - Throw `InvalidFindingWeightError` for any non-finite or negative weight; document that these are internal contracts, not an API for client-supplied findings or weights
    - Clamp to `[0, 100]` and round to integer; identical findings always yield identical score
    - Keep other deterministic and AI contributions additive with no cross-engine dedup, and add tests that make this explicit (AI alone and repeated shortened URLs can reach the highest tier); document the score as an uncalibrated heuristic (Req 6.10)
    - Create `lib/scoring/assessment.ts` with `assessScan(det: DeterministicResult, ai: AiOutcome)`: the shared completion rule producing the discriminated `ScanResult` fields (incomplete → `riskScore`, `severityTier`, `waxSealColor` all `null`), ignoring AI findings when AI is unavailable, and using `FALLBACK_VERIFICATION_STEPS` when AI is unavailable or returns no steps
    - Create `severityTierForScore(score: number): { tier: SeverityTier; color: string }`
    - Map score ranges: 0–39 to "Low risk — still verify independently" (Potion Emerald #059669), 40–69 to "Caution — verify before acting" (Candlelight Gold #D97706), 70–100 to "TRAP DETECTED" (Crimson Wax #DC2626)
    - Tier derives strictly from score, never the reverse
    - Never present a deterministic result with `status: "incomplete"` as a completed "Low risk — still verify independently" assessment (Req 6.9)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.8, 6.9, 6.10_

  - [ ]* 5.2 Write property test for risk-score boundary mapping
    - **Property 5: Risk-score boundaries map to the correct severity tier**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [x] 5.3 Implement evidence report builder
    - Create `lib/report/evidenceReport.ts` with `buildEvidenceReport(result: ScanResult): string` producing Markdown
    - Include scan timestamp, input type, Risk_Score, Severity_Tier, deterministic findings, AI findings, recommended verification steps, and advisory disclaimer
    - When AI is unavailable, include deterministic findings and explicit "AI analysis unavailable" notice; still generate the report
    - Create `reportFilename(timestamp: string): string` returning `scryvorn-report-YYYYMMDD-HHmmss.md`
    - When the deterministic run is incomplete, state "Assessment incomplete — no overall risk score or tier assigned.", list the unfinished checks, and keep the collected evidence; do not present the report as a completed assessment (Req 6.9)
    - Use the seven report sections from Req 9.7 (no "Verified Checks" heading); state the exact inactive-lookalike sentence (Req 9.8); put HTTPS/TLD findings under "Informational context" and domain-age unavailability under "Checks not performed / unavailable"; when AI is unavailable, ignore supplied AI findings and show "AI analysis unavailable"
    - Escape Markdown/HTML and defang URLs/domains in all untrusted report content via `lib/report/safeMarkdown.ts`, without changing the findings in memory (Req 9.9)
    - Require an ISO 8601 timestamp with `Z` or a numeric offset; throw `InvalidTimestampError` otherwise; render and name the file in UTC (Req 9.10)
    - Label steps as recommendations; use fallback steps when none are supplied; never claim a destination was visited or confirmed (Req 9.11)
    - _Requirements: 6.9, 6.10, 9.2, 9.3, 9.4, 9.7, 9.8, 9.9, 9.10, 9.11_

  - [ ]* 5.4 Write property test for evidence report with AI unavailable
    - **Property 6: Evidence report is complete and timestamped when AI is unavailable**
    - **Validates: Requirements 6.8, 9.2, 9.4, 7.5**

- [x] 6. Implement API scan route
  - [x] 6.1 Implement POST /api/scan route (Node.js runtime)
    - Create `app/api/scan/route.ts` as a POST handler on the standard Next.js App Router Node.js runtime; do not use the Edge Runtime (Req 11.7)
    - Validate in this order: `Content-Type` is `application/json`, the body parses as a JSON object, and `input` is a string, otherwise 400 `{ "error": "invalid_request" }`; then 400 `{ "error": "input_required" }` if empty after trimming; then 400 `{ "error": "input_too_long" }` if longer than `INPUT_MAX_CHARS`
    - Read only `input` from the body; ignore any client-supplied findings, weights, scores, or tiers; generate all findings server-side
    - Run the deterministic checks to completion, build the summary with `buildDeterministicSummary` (`lib/ai/deterministicSummary.ts`, see design "Deterministic summary"), then run AI interpretation, then combine with `assessScan`
    - Run AI interpretation even when the deterministic run is incomplete; `assessScan` still returns the incomplete variant with null `riskScore`, `severityTier`, and `waxSealColor`; do not add a `"skipped"` value to `aiUnavailableReason`
    - If AI is unavailable (timeout or error), complete the scan with deterministic results only; `aiAvailable: false` and `aiUnavailableReason` come from `assessScan`
    - Derive `inputType` from whether URLs were found in the input; set `timestamp` as an ISO 8601 UTC string
    - Return 200 with the full discriminated `ScanResult` JSON: `timestamp`, `inputType`, `deterministicStatus`, `incompleteChecks`, `riskScore`, `severityTier`, `waxSealColor`, `deterministicFindings`, `aiFindings`, `recommendedSteps`, `aiAvailable`, `aiUnavailableReason` (only when AI is unavailable), `lookalikeCheckActive`, `domainAgeAvailable`, `disclaimer`; score, tier, and color are `null` for incomplete runs
    - Build the response with `assessScan` (do not reconstruct the completion rule); an incomplete run must not be returned as a completed "Low risk" assessment (Req 6.9)
    - Return 500 `{ "error": "internal_error" }` for any unexpected failure; error bodies are fixed strings that never echo the request
    - Set `Cache-Control: no-store` on every response generated by the route handler (200, 400, 500); framework-generated 405 and OPTIONS responses do not currently carry it; no logging of user input, URLs, findings, AI output, or results on any path
    - Accepted limitations (design "Accepted Task 6 limitations"): no request-body size limit before JSON parsing; untrusted content and instructions share one user message (escaping reduces but does not prevent prompt injection); no live AI provider verified; the 60-second Netlify limit is unmeasured against a real deploy-preview request; npm audit findings unchanged and need a separate decision
    - Non-POST methods: rely on the framework's 405 (observed locally with `next start`: no `Cache-Control` header on the framework 405 or the OPTIONS 204); confirm on the first Netlify deploy
    - Keep `AI_TIMEOUT_MS` at 30,000 ms; the route runs within Netlify's 60-second synchronous limit (not configurable); do not claim a proven safety margin until a deploy-preview request is measured
    - Summary caps (approved, in `lib/constants.ts`): `DETERMINISTIC_SUMMARY_MAX_FINDINGS = 20`, `DETERMINISTIC_SUMMARY_MAX_LINE_CHARS = 200`, `DETERMINISTIC_SUMMARY_MAX_TOTAL_CHARS = 3000`
    - Do not inject a domain-age service in the route (production domain-age lookup stays unconfigured)
    - Do not enable a production domain-age service until a bounded policy is approved: maximum lookups per scan, per-lookup timeout, overall budget, behavior when the budget is reached, and `AbortSignal` support (Req 11.10; design "Domain-age lookup timing")
    - Before deployment, complete the pre-deployment checks in design "Deployment Topology" (publish-directory auto-detection, route handler and 405 behavior, environment variables on the actual plan, measured deploy-preview request)
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 6.8, 6.9, 8.2, 8.4, 8.5, 11.1, 11.7, 11.8, 11.9, 11.10_

- [x] 7. Implement theme and scanner input UI components
  - [x] 7.1 Implement Header component
    - Create `components/theme/Header.tsx` with Moonlit Midnight (#0D1117) background
    - Render decorative crescent moon and bat motif behind header text with `aria-hidden="true"` and low opacity so text stays distinguishable
    - _Requirements: 2.1_

  - [x] 7.2 Implement SpiderwebCorners component
    - Create `components/theme/SpiderwebCorners.tsx` with decorative geometric SVG corner accents
    - Set `aria-hidden="true"`, `pointer-events: none`; position to not overlap input or results areas (layout overlap to be verified during Task 9.2)
    - _Requirements: 2.4_

  - [x] 7.3 Implement ScannerInput component
    - Create `components/scanner/ScannerInput.tsx` with `<textarea>` capped at 10,000 characters
    - Display live character counter
    - Render Pumpkin Orange (#FF5A1F) submit button
    - Client-side validation: inline "input required" message on empty submit (retain content, block scan); inline "maximum input length exceeded" message on paste exceeding limit
    - All controls keyboard-accessible with visible focus states
    - _Requirements: 1.1, 1.5, 1.6, 2.3, 2.7_

  - [x] 7.4 Implement SampleTrapButtons component
    - Create `components/scanner/SampleTrapButtons.tsx` with three buttons: "Fake Remote Job DM", "Phishing Payment Link", "Legitimate Bank Alert"
    - Clicking a button replaces any existing textarea content with the corresponding synthetic sample string
    - All buttons keyboard-accessible with visible focus states
    - _Requirements: 1.2, 1.3, 2.7_

  - [x] 7.5 Implement LoadingState component
    - Create `components/scanner/LoadingState.tsx` with a simple visible loading indicator
    - Display text "Inspecting message and links…" while the POST request is in flight
    - Clear on response (success, error, or unavailable handled by result rendering)
    - Do not display individual deterministic-check completion updates (single request/response flow)
    - _Requirements: 2.8, 3.2_

- [x] 8. Implement results, export, advisory, and roadmap UI components
  - [x] 8.1 Implement VerifiedChecks component
    - Create `components/scanner/VerifiedChecks.tsx` rendering only deterministic findings
    - Display a visible heading identifying evidence type as deterministic
    - Render each finding as a discrete item with label identifying the check type and affected URL, and evidence value stating the outcome
    - _Requirements: 4.5, 7.1, 7.3_

  - [x] 8.2 Implement AiInterpretation component
    - Create `components/scanner/AiInterpretation.tsx` rendering only AI findings
    - Display a visible heading identifying evidence type as AI-generated
    - Show explicit "AI analysis unavailable" notice when AI is unavailable; never display fabricated AI findings
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 8.3 Implement WaxSealVerdict component
    - Create `components/scanner/WaxSealVerdict.tsx` rendering a wax-seal-style stamp
    - Display Severity_Tier and Risk_Score; color per tier (Crimson Wax #DC2626 for TRAP DETECTED, Candlelight Gold #D97706 for Caution, Potion Emerald #059669 for Low risk)
    - Never render "Verified Safe" or any wording claiming the input is definitively safe
    - Display itemized evidence supporting the Risk_Score alongside the stamp
    - When the deterministic run is incomplete, show that the checks did not complete instead of a completed "Low risk" stamp (Req 6.9)
    - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.7, 6.9_

  - [x] 8.4 Implement EvidenceReportExport component
    - Create `components/scanner/EvidenceReportExport.tsx` with "Copy Evidence Report" and "Download Report (.md)" buttons
    - Copy button copies full report text to system clipboard and shows confirmation indicating copy succeeded
    - Download button triggers Markdown file download with timestamped filename
    - Disable both buttons until a scan has completed
    - On copy or download failure, show error notice and preserve the Evidence_Report so the user can retry
    - All controls keyboard-accessible with visible focus states
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

  - [x] 8.5 Implement AdvisoryDisclaimer component
    - Create `components/scanner/AdvisoryDisclaimer.tsx` rendering advisory disclaimer banner
    - Display text stating Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice
    - _Requirements: 8.1_

  - [x] 8.6 Implement RoadmapSection component
    - Create `components/roadmap/RoadmapSection.tsx` with "Coming Soon — Product Roadmap" heading
    - Display "Contract & Lease PDF X-Ray" and "Subscription Drain Hunter" as distinct roadmap items showing their title text
    - No implementation of contract/lease PDF parsing, bank-statement analysis, or subscription-drain detection functionality
    - _Requirements: 10.1, 10.2, 10.3_

  - Accepted Task 8 deviations and follow-ups:
    - `lib/report/` exports were refactored to share defanging (`defangText`), check labels, finding partitioning, and fixed notices with the UI. The report output is behavior-preserving and the existing report tests pass.
    - Crimson Wax (#DC2626) text on parchment (#F8F3E6) is about 4.36:1, below the 4.5:1 normal-text target. Task 8 uses dark-ink error text with a Crimson Wax accent border. The Task 7 ScannerInput error text still uses Crimson Wax and needs a contrast follow-up in Task 9.
    - Recommended verification steps are currently included only in the Evidence Report; their UI placement must be decided in Task 9.
    - jsdom tests mock the clipboard and download APIs; they do not verify real browser clipboard writes, downloads, focus rings, layout, or tab order.

- [x] 9. Assemble page and wire components together
  - [x] 9.1 Create sample traps data
    - Create `lib/samples/sampleTraps.ts` with three synthetic sample strings
    - "Fake Remote Job DM": fictional remote job scam message with fictional names and URLs
    - "Phishing Payment Link": fictional phishing payment message with placeholder financial details
    - "Legitimate Bank Alert": fictional bank alert that produces a low-risk result with no fabricated AI findings and displays independent-verification guidance
    - Use only fictional names, fictional URLs, and placeholder financial details; no real personal, banking, or victim data
    - Do not imply through the "Legitimate Bank Alert" sample or any sample that any bank message is automatically safe
    - _Requirements: 1.2, 1.3, 1.7, 1.8_

  - [x] 9.2 Implement ScannerCard composition
    - Create `components/scanner/ScannerCard.tsx` as a Warm Aged Parchment (#F8F3E6) card with dark ink (#1A1614) text
    - Compose ScannerInput, SampleTrapButtons, LoadingState, SpiderwebCorners, VerifiedChecks, AiInterpretation, WaxSealVerdict, and EvidenceReportExport
    - Ensure decorative spiderweb corners do not overlap the scan input field or results display area
    - _Requirements: 2.2, 2.4_

  - [x] 9.3 Create root layout
    - Create `app/layout.tsx` with root layout, theme fonts, and global Tailwind styles
    - Include Header component and AdvisoryDisclaimer
    - _Requirements: 2.1, 2.2, 8.1_

  - [x] 9.4 Create main page and wire scan flow
    - Create `app/page.tsx` as the single page serving as both scan page and landing page
    - Compose ScannerCard, AdvisoryDisclaimer, and RoadmapSection
    - Wire scanner submission to POST `/api/scan` with `fetch`; send `{ input }` and render result from the single JSON response
    - Manage scan state: idle, loading (show LoadingState), success (render results with Verified Checks, AI Interpretation, Wax-Seal, export), error (show error state)
    - On 400 response with `input_required`, show inline validation; on other non-200, show generic error state
    - Clear Scanner_Input and scan results from component state on navigation or refresh (page session only)
    - Never write inputs, URLs, or results to localStorage, IndexedDB, files, or third-party storage
    - Responsive layout with no horizontal scrolling at 360px (mobile), 768px (tablet), and 1024px (desktop)
    - Ensure all interactive controls (sample buttons, text input, submit, copy, download) are keyboard-accessible with visible focus states
    - _Requirements: 1.4, 2.6, 2.7, 2.8, 3.1, 3.2, 3.5, 3.6, 3.7, 3.8, 8.2, 8.3_

  - Accepted Task 9 deviations, limitations, and pending manual checks:
    - Added (approved): `RecommendedSteps` between AiInterpretation and the export controls, using the shared `selectRecommendedSteps` rule; `ScannerInput` `serverError` prop; `input_too_long` is shown inline as well as `input_required`; a 45-second client timeout (`SCAN_CLIENT_TIMEOUT_MS`) via AbortController; request/response handling lives in `lib/scan/scanClient.ts`.
    - EvidenceReportExport is always rendered (after the results) so its buttons stay visibly disabled until a scan completes.
    - AdvisoryDisclaimer is rendered once, in the root layout footer (`app/layout.tsx`); `app/page.tsx` composes ScannerCard and RoadmapSection only and does not render it again (deviation from the 9.4 "Compose ... AdvisoryDisclaimer" wording).
    - `app/layout.tsx` uses the Tailwind default system font stack and loads no external web fonts (no separate "theme fonts" are configured).
    - ScannerInput error text now uses Dark Ink with a Crimson Wax left accent border (Task 8 follow-up resolved).
    - Without AI configured, "Fake Remote Job DM" and "Phishing Payment Link" each produce a deterministic score of 36 and display the Low-risk tier. Their scored findings can come only from scam-trigger phrases, because .example and .test domains are not in the shortener or elevated-attention TLD lists, and the scam-trigger total is capped at 36.
    - Accepted for the synthetic offline samples. AI is not assumed to elevate either sample to Caution or TRAP DETECTED: live AI output is model-dependent and must be verified on a deploy preview.
    - No demo-only entries are to be added to the production scam-trigger, shortener, or elevated-attention TLD data lists at this time. SCORING_WEIGHTS and the scam-trigger cap stay unchanged. (Superseded by Task 15: the cap is now 60 and link-structure rules were added; see design "Scoring Configuration".)
    - Not verified by automated tests (jsdom): spiderweb overlap with the input/results areas, absence of horizontal scrolling at 360/768/1024 px, real focus rings and tab order, real clipboard writes, real downloads, and real network behavior against a deployed `/api/scan`. These need manual browser checks.
    - Pumpkin Orange focus outlines on parchment measure about 2.81:1, below the 3:1 non-text contrast target; not changed in Task 9 and needs a follow-up decision.

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Write integration, component, and compliance tests
  - [x]* 11.1 Write scan route integration tests
    - Exercise `/api/scan` with mocked AI and domain-age services
    - Assert deterministic checks run to completion before AI starts
    - Assert single JSON response is well-formed (full ScanResult)
    - Assert AI timeout path (artificially shortened timeout in tests) degrades gracefully with deterministic results only and "AI analysis unavailable" notice
    - Assert AI error path degrades gracefully
    - Assert Risk_Score computed from deterministic findings alone when AI unavailable
    - Assert domain-age configured enriches findings; unconfigured and failed paths append absence note and scan completes
    - Assert no `localStorage`/IndexedDB writes occur during a full scan
    - Assert server route writes no input/result to logs
    - _Requirements: 3.1, 3.3, 3.4, 4.6, 4.7, 6.8, 8.2, 8.4, 8.5_

  - [x]* 11.2 Write component tests with React 19 `act` + jsdom helpers (`test/dom.ts`); React Testing Library is not used or installed
    - Assert sample buttons replace textarea content
    - Assert empty submit shows inline validation and does not call the API
    - Assert loading indicator appears during scan and clears on response
    - Assert Verified Checks renders only deterministic findings; AI Interpretation renders only AI findings
    - Assert Wax-Seal shows correct tier, color, and score
    - Assert Copy/Download disabled until scan completes, enabled after
    - Assert export failure shows notice and preserves report for retry
    - Assert all primary controls are native, focusable controls without a negative tabindex (visible focus rings and real tab order are manual browser checks; jsdom does not verify them)
    - Assert "Legitimate Bank Alert" sample yields low-risk result with no fabricated AI findings and independent-verification guidance (mocked AI)
    - Assert advisory disclaimer and section headings are present
    - Assert "Coming Soon" roadmap section and two item titles render
    - _Requirements: 1.2, 1.3, 1.5, 1.7, 2.7, 2.8, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 9.1, 9.5, 9.6, 10.1, 10.2_

  - [x]* 11.3 Write smoke and compliance tests
    - Validate data-file schemas: each JSON has `version`, `source`, `date`, and a non-empty list
    - Assert `.env.example` exists and lists every required env var with clearly-placeholder values
    - Assert `.gitignore` includes `.env.local` and keeps `.kiro/` tracked
    - Assert no literal secrets in committed source (secret-pattern scan)
    - Assert `LICENSE` contains MIT text
    - Assert no contract-PDF, bank-statement, or subscription-drain modules exist in the codebase
    - Assert build succeeds without those modules
    - Assert `app/api/scan/route.ts` does not export `runtime = "edge"` (Req 11.7)
    - Assert `netlify.toml`, if present, declares no secret environment variables (Req 11.9)
    - _Requirements: 4.10, 10.3, 11.1, 11.3, 11.4, 11.5, 11.6, 11.7, 11.9_

  - Task 11 coverage notes and limitations:
    - New files: `app/api/scan/route.integration.test.tsx` (11.1), `components/scanner/ScannerCard.flow.test.tsx` (11.2), `tests/compliance.test.ts` (11.3). Bullets already satisfied by earlier tests were not duplicated.
    - 11.1 domain age: the route injects no domain-age service, so route-level enrichment is not tested. Configured, unconfigured, and failed behavior is covered at the engine level (`lib/checks/deterministicEngine.test.ts`).
    - 11.1 persistence and logging: route tests stub Web Storage, IndexedDB, and a cookie setter, record fs write calls made through the test module graph, assert console is never called, and assert no stdout/stderr write contains the user text. They do not observe writes made outside the test module graph.
    - 11.2 focus: tests assert native, focusable controls without a negative tabindex. Visible focus rings, real tab order, layout overlap, real clipboard writes, and real downloads are manual browser checks.
    - 11.2 "Legitimate Bank Alert": uses the real deterministic engine and assessScan with a mocked successful AI response that returns no findings and no steps; a live AI response may differ.
    - 11.3 build: "build succeeds without those modules" is verified by the separate `npm run build` command, not inside Vitest.
    - 11.3 secret scan: heuristic patterns over tracked and untracked non-ignored files, with an explicit allowlist of four synthetic test fixtures. Passing it does not prove that no secrets exist.
    - `.env.example`: `AI_MODEL` now uses a placeholder value; the domain-age variables are marked "# Optional / currently disabled in code" and are not required.

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Task 12 covers automated local verification only: `npx vitest run` (31 test files, 446 tests passed), `npx tsc --noEmit` (exit 0, no output), and `npm run build` (exit 0; `/` and `/_not-found` static, `/api/scan` dynamic). It does not establish production readiness, absence of vulnerabilities, or a full accessibility audit.
  - Manual checks outstanding before production use:
    - Local browser checks at 360, 768, and 1024 px: horizontal scrolling, spiderweb overlap, keyboard order, visible focus, clipboard copy and report download, refresh clearing the input and results, and screen-reader announcements.
    - Deploy-preview checks: AI-configured and AI-unavailable paths, actual tiers for the three samples, request timing against the 45-second client timeout and Netlify's 60-second limit, Cache-Control headers on 200/400/500 responses, AI provider rate limiting, and absence of secrets or user text in function logs.
  - Accepted limitations:
    - npm audit findings remain, including two production findings through Next's bundled PostCSS; the major upgrades that would fix them (`next@16`, `vitest@5`) are deferred.
    - No request-body size limit is applied before JSON parsing.
    - Prompt-injection risk is reduced by escaping but not eliminated.
    - Framework-generated 405 and OPTIONS responses do not carry `Cache-Control: no-store`.
    - Pumpkin Orange focus outlines on parchment are about 2.81:1, below the 3:1 non-text contrast target.
    - `next lint` has no ESLint dependency or configuration.
    - Domain-age lookup remains disabled pending an approved rate-limit and timeout policy.

- [ ] 13. Halloween forensic-laboratory redesign (later design revision; uncommitted, awaiting visual review)
  - Landing page at `/` (`components/landing/LandingPage.tsx`); the four-state inspection app moved to `/inspect` (`app/inspect/page.tsx`). `/api/scan` is unchanged. Every "Examine a message" call to action links to `/inspect`; "How it works" links to `/#how-it-works` and "About" to `/#about`.
  - The inspection app keeps the existing ScannerCard state machine and the real backend path (scanClient → POST /api/scan → runDeterministicChecks → runAiInterpretation → assessScan; reports from buildEvidenceReport). The four views (awaiting, examining, revealed, preserved) are derived from that state; the examining view appears only while a real request is in flight. No demo, mock, or hardcoded results are shown.
  - Results sections: Evidence found, Context observed, Checks not performed (rule-based), AI interpretation, Recommended steps. Every item shows provenance (Message rules, Link checks, or AI interpretation; `lib/report/provenance.ts`). The tier is the real Severity_Tier; the incomplete panel stays neutral.
  - Revised Req 2.1–2.4, Req 6.2–6.4 (tier accent colors #B91C1C / #E8892B / #15803D), and Req 9.5 (export buttons appear only after a completed scan). Submit label is now "Examine the evidence →". The three sample labels are unchanged.
  - Decorative Halloween layer (`components/halloween/`): all aria-hidden, focusable="false" on SVGs, pointer-events none, clipped against horizontal overflow, still under prefers-reduced-motion. The tarantula moves in a dedicated lane between main content and the footer.
  - Fonts: Cormorant Garamond and Inter via next/font/google with system fallbacks. next/font downloads font files at build time; if the build machine has no network access the build may fail rather than silently fall back, so build-time network access is required.
  - The earlier uncommitted "Midnight Evidence Desk" revision is preserved in git stash "midnight-evidence-desk" and is not part of this redesign.
  - Plain-English layer (`lib/report/plainLanguage.ts`): a "What this means" summary in the complete verdict and a short explanation on each scored evidence card. Wording is fixed and reviewed per finding category; categories without reviewed wording get no explanation. The AI line uses only the AI findings' own labels, or the exact AI-unavailable notice. Nothing calls a message safe, legitimate, or fraudulent. The incomplete panel has no summary.
  - Tarantula: one instance walking only reserved space — the bottom lane on small screens, and on wide screens (lg+) a perimeter of the left gutter, bottom lane, and right gutter (main reserves `lg:px-20` gutters). Still at its lane resting position under reduced motion.
  - Not verified by automated tests: visual quality, real browser focus rings, motion behavior, and screen-reader output.

- [ ] 14. Saved Investigations, report formats, and Halloween polish (uncommitted, awaiting review)
  - Saved Investigations (Requirement 12; steering "Disclosed exception"): `lib/storage/savedInvestigations.ts` and `components/scanner/SavedInvestigations.tsx`; automatic, browser-only, disclosed, deletable.
  - Evidence Report: displayed as a formatted document with no Markdown symbols; Copy and `.txt` use the same plain text; a real PDF is generated by `lib/report/pdf.ts` (no dependencies). All formats derive from buildEvidenceReport through `lib/report/reportDocument.ts` (Req 9.2 revised).
  - Flow: a Submit / Examine / Results / Report step indicator; the examining view lists the three real pipeline stages; "Start a new investigation" begins a fresh, empty examination.
  - Decorations: the caped vampires are removed; the cathedral cobwebs are replaced with gothic corner tracery and stone gargoyles; ghosts on both sides; bats on independent flight paths; fewer, spread-out lanterns and candles.
  - Performance: decorative motion animates only transform and opacity; blur and drop-shadow filters on moving elements are removed; the tarantula walks with a compositor transform (container query units) and its legs and body are separate layers; the radar sweep is its own rotating layer.

- [ ] 15. Deterministic detection for unseen links, and Kiro hooks (uncommitted, awaiting review)
  - New required check `url_structure` (`lib/checks/urlStructure.ts`, rules in `data/urlRiskSignals.json`): raw IP host, text hidden before "@", punycode, ".com" placed before the real domain or 6+ labels, digits standing in for letters, sensitive words in the host (heavier with 3+) or path, 3+ hyphens, non-default port. Pure parsing; links are never fetched. Each finding quotes the address part and cites the rule set.
  - `extractUrls` also accepts bare `name.tld` links when the TLD is on the reviewed `bareDomainTlds` list (not emails, file names, or names like "Node.js"). `parseHostname` accepts scheme-less links, so `www.` hosts now get domain checks too.
  - Scam-trigger phrase sets expanded (v2026.02): new categories account threat, prize lure, gift-card payment, delivery pretext, investment lure, plus more phrases in the existing categories. Reviewed plain-English wording added for every new category.
  - `scam_trigger_max_total` raised from 36 to 60. Without AI: Fake Remote Job DM 48 (Caution), Phishing Payment Link 61 (Caution), Legitimate Bank Alert 0.
  - Kiro hooks in `.kiro/hooks/`: `secret-guard.json` (PreToolUse; `scripts/hooks/secret-guard.mjs` blocks writes containing real-looking keys or private keys) and `evidence-rules-on-save.json` (PostFileSave on `lib/checks`, `lib/scoring`, `lib/ai`, `data/*.json`; asks the agent to run the rule tests and keep the No Evidence, No Verdict wording).

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–6 from the design document)
- Unit tests validate specific examples and edge cases
- Integration tests validate the full pipeline and graceful degradation
- Compliance tests validate deployment and secrets requirements
- The design uses TypeScript (Next.js App Router) — no language selection was needed
- All code follows the Autumn Lantern theme with WCAG AA contrast targets
- Full WCAG validation requires manual testing with assistive technologies and expert review

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "2.2", "9.1"] },
    { "id": 2, "tasks": ["3.1", "3.3", "3.5", "3.7", "3.8", "3.10", "4.1", "5.1", "5.3", "7.1", "7.2", "7.3", "7.4", "7.5", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "3.9", "3.11", "4.2", "5.2", "5.4", "9.2", "9.3"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["9.4"] },
    { "id": 6, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
