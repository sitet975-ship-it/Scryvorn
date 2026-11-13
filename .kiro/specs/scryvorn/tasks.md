# Implementation Plan: Scryvorn Message-and-URL Scanner MVP

## Overview

Scryvorn is a single-page Next.js application that runs a two-layer forensics pipeline on user-pasted suspicious messages and URLs: deterministic, rule-based checks first, then AI interpretation. The pipeline combines both layers into a 0–100 Risk_Score and a Severity_Tier rendered as a wax-seal stamp, with itemized evidence split into separate "Verified Checks" and "AI Interpretation" sections. The user can copy or download an Evidence_Report. The app degrades gracefully when the AI service or optional domain-age lookup is unavailable, never claims a message is definitively safe, and retains nothing beyond the page session.

The implementation follows the layered architecture from the design: pure deterministic check functions in `/lib/checks/`, AI interpretation in `/lib/ai/`, scoring and report generation in `/lib/scoring/` and `/lib/report/`, a single Edge Runtime POST route at `/api/scan`, and modular React components with the Autumn Lantern theme. Tasks build incrementally from project setup through core logic, API orchestration, UI components, and final wiring, with property-based tests placed close to each implementation.

## Tasks

- [ ] 1. Set up project structure, data files, and compliance configuration
  - [ ] 1.1 Initialize Next.js project with TypeScript strict mode and Tailwind CSS
    - Create `package.json` with Next.js, React, TypeScript dependencies
    - Configure `tsconfig.json` with `strict: true`
    - Configure `tailwind.config.ts` with Scryvorn theme color tokens (Moonlit Midnight #0D1117, Warm Aged Parchment #F8F3E6, Dark Ink #1A1614, Pumpkin Orange #FF5A1F, Crimson Wax #DC2626, Candlelight Gold #D97706, Potion Emerald #059669)
    - Set up `postcss.config.ts` for Tailwind
    - _Requirements: 11.1_

  - [ ] 1.2 Create versioned reference data files
    - Create `data/shorteners.json` with `version`, `source`, `date`, and `domains` array (bit.ly, tinyurl.com, t.co, goo.gl, ow.ly, is.gd, buff.ly)
    - Create `data/elevatedAttentionTlds.json` with `version`, `source`, `date`, and `tlds` array (.xyz, .top, .click, .country, .stream, .live, .rest, .cyou); TLD matches are informational context, not a high-risk verdict
    - Create `data/scamTriggers.json` with `version`, `source`, `date`, and `categories` array containing six categories (upfront_payment, credential_request, urgency_pressure, off_platform_move, crypto_payment_demand, suspicious_job_offer), each with `id`, `label`, and `phrases`
    - _Requirements: 4.10, 4.11, 5.1–5.6_

  - [ ] 1.3 Set up testing framework
    - Install Vitest and `jsdom` only (do not install `@testing-library/react`, `@testing-library/jest-dom`, or `fast-check` until the core scanner works)
    - Create `vitest.config.ts` with jsdom environment and path aliases matching tsconfig
    - Add test scripts to `package.json` (`test`, `test:run`)

  - [ ] 1.4 Create deployment and secrets compliance files
    - Create `.env.example` listing `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`, `DOMAIN_AGE_API_URL`, `DOMAIN_AGE_API_KEY` with clearly-placeholder non-functional values
    - Update `.gitignore` to include `.env.local` and keep `.kiro/specs/`, `.kiro/steering/`, `.kiro/hooks/` tracked
    - Verify `LICENSE` contains standard MIT license text
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 2. Create core types and constants
  - [ ] 2.1 Create shared TypeScript types
    - Create `lib/types.ts` with `SeverityTier`, `InputType`, `ScanResult` interfaces
    - Create `lib/checks/types.ts` with `CheckName`, `DeterministicFinding`, `DeterministicResult`
    - Create `lib/ai/types.ts` with `AiFinding`, `AiOutcome`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

  - [ ] 2.2 Create constants module
    - Create `lib/constants.ts` with theme palette hex values, `INPUT_MAX_CHARS` (10000), `AI_TIMEOUT_MS` (30000), `SCORING_WEIGHTS` (deterministic and AI weights), `SEVERITY_TIERS` (three tiers with min/max/color), and `ADVISORY_DISCLAIMER` text
    - _Requirements: 2.1–2.4, 4.8, 6.1–6.5, 8.1_

- [ ] 3. Implement deterministic check engine (pure functions)
  - [ ] 3.1 Implement URL Extractor
    - Create `lib/checks/urlExtractor.ts` with `extractUrls(text: string): string[]`
    - Extract every URL from message text; skip unparseable tokens gracefully without crashing
    - _Requirements: 4.1_

  - [ ]* 3.2 Write property test for URL extraction
    - **Property 1: URL extraction recovers all embedded URLs**
    - **Validates: Requirements 4.1**

  - [ ] 3.3 Implement HTTPS Validator
    - Create `lib/checks/httpsValidator.ts` with `checkHttps(url: string): DeterministicFinding`
    - Record whether URL uses HTTPS scheme; finding always carries `weight: 0` (informational only)
    - _Requirements: 4.2, 4.8_

  - [ ]* 3.4 Write property test for HTTPS informational handling
    - **Property 2: HTTPS status is informational and never contributes to the risk score**
    - **Validates: Requirements 4.2, 4.8**

  - [ ] 3.5 Implement Shortener Detector
    - Create `lib/checks/shortenerDetector.ts` with `detectShortener(url: string, list: ShortenerList): DeterministicFinding | null`
    - Flag URLs whose registrable domain is in the shortener list; cite list version in `reference` field
    - _Requirements: 4.3, 4.11_

  - [ ]* 3.6 Write property test for shortener detection
    - **Property 3: URL-shortener detection matches the list**
    - **Validates: Requirements 4.3**

  - [ ] 3.7 Implement Domain Heuristic
    - Create `lib/checks/domainHeuristic.ts` with `domainHeuristic(url: string, tldList: ElevatedAttentionTldList): DeterministicFinding[]`
    - Flag suspicious TLDs from the elevated-attention TLD list with specific reason in evidence; TLD findings are informational context, not a high-risk verdict
    - Flag lookalike domains using conservative similarity rules (character substitution, omission, typosquatting); display suspected legitimate domain and similarity reason
    - Label low-confidence lookalike matches as "Needs manual verification" rather than asserting impersonation
    - Cite list version in `reference` for TLD findings
    - _Requirements: 4.4, 4.12_

  - [ ] 3.8 Implement Scam Trigger Detector
    - Create `lib/checks/scamTriggerDetector.ts` with `detectScamTriggers(text: string, triggerSet: ScamTriggerSet): DeterministicFinding[]`
    - Match input against six trigger phrase sets: upfront payment, credential request, urgency pressure, off-platform move, crypto payment demand, suspicious job offer
    - Produce exactly one finding per matched category; include category label and matched phrase text in each finding
    - Deterministic: identical input always produces identical findings
    - Produce zero findings when no category matches
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ]* 3.9 Write property test for scam-trigger detection
    - **Property 4: Scam-trigger detection yields one finding per matched category and none otherwise**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10**

  - [ ] 3.10 Implement Domain Age Lookup
    - Create `lib/checks/domainAgeLookup.ts` with `lookupDomainAge(domain: string, service?: DomainAgeService): Promise<DeterministicFinding | null>`
    - Return domain registration age finding when service is configured and succeeds
    - Return null when service is unconfigured or fails (timeout, error, unreachable); engine appends informational note
    - _Requirements: 4.6, 4.7_

  - [ ] 3.11 Implement Deterministic Engine orchestrator
    - Create `lib/checks/deterministicEngine.ts` with `runDeterministicChecks(input: string, opts?): Promise<DeterministicResult>`
    - Call pure check functions in fixed order: extractUrls, then per-URL checkHttps/detectShortener/domainHeuristic, then detectScamTriggers, then optional domainAgeLookup
    - Load versioned data files (shorteners.json, elevatedAttentionTlds.json, scamTriggers.json) and pass to check functions
    - Append informational "domain-age data unavailable" finding when lookup is unconfigured or fails
    - Analyze URL structure and metadata only; never fetch, crawl, render, screenshot, or download content from user-supplied URLs
    - _Requirements: 3.1, 4.1, 4.5, 4.6, 4.7, 4.9, 4.10, 4.11_

- [ ] 4. Implement AI interpretation engine
  - [ ] 4.1 Implement AI prompt builder
    - Create `lib/ai/prompt.ts` with `buildAiPrompt(input: string, deterministicSummary: string): string`
    - Instruct model to return JSON `{ findings: [{category, label, evidence, severity}], recommendedSteps: [] }`
    - Instruct model to only report findings supported by the input (empty array if none)
    - Instruct model to never claim the input is safe or use the phrase "Verified Safe"
    - Instruct model to base `severity` on confidence (`low`, `medium`, `high`)
    - _Requirements: 3.3, 6.6_

  - [ ] 4.2 Implement AI interpretation engine with timeout
    - Create `lib/ai/aiInterpretation.ts` with `runAiInterpretation(input: string, deterministicSummary: string, opts: { timeoutMs: 30000 }): Promise<AiOutcome>`
    - Use `AbortController` with configurable timeout (default 30000 ms)
    - Call OpenAI-compatible Chat Completions API via `fetch` using `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL` from environment variables
    - Parse structured JSON response; treat malformed JSON as an error
    - Return `{ unavailable: true, reason: "timeout" }` on timeout, `{ unavailable: true, reason: "error" }` on error or malformed response
    - Return `{ unavailable: false, findings, recommendedSteps }` on success
    - _Requirements: 3.3, 3.4, 3.7_

- [ ] 5. Implement scoring and evidence report generation
  - [ ] 5.1 Implement risk score computation and severity tier mapping
    - Create `lib/scoring/riskScore.ts` with `computeRiskScore(det: DeterministicFinding[], ai: AiFinding[]): number`
    - Sum configured per-finding weights from `SCORING_WEIGHTS`; cap total scam-trigger contribution at `scam_trigger_max_total`
    - Clamp to `[0, 100]` and round to integer; identical findings always yield identical score
    - Create `severityTierForScore(score: number): { tier: SeverityTier; color: string }`
    - Map score ranges: 0–39 to "Low risk — still verify independently" (Potion Emerald #059669), 40–69 to "Caution — verify before acting" (Candlelight Gold #D97706), 70–100 to "TRAP DETECTED" (Crimson Wax #DC2626)
    - Tier derives strictly from score, never the reverse
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.8_

  - [ ]* 5.2 Write property test for risk-score boundary mapping
    - **Property 5: Risk-score boundaries map to the correct severity tier**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [ ] 5.3 Implement evidence report builder
    - Create `lib/report/evidenceReport.ts` with `buildEvidenceReport(result: ScanResult): string` producing Markdown
    - Include scan timestamp, input type, Risk_Score, Severity_Tier, deterministic findings, AI findings, recommended verification steps, and advisory disclaimer
    - When AI is unavailable, include deterministic findings and explicit "AI analysis unavailable" notice; still generate the report
    - Create `reportFilename(timestamp: string): string` returning `scryvorn-report-YYYYMMDD-HHmmss.md`
    - _Requirements: 9.2, 9.3, 9.4_

  - [ ]* 5.4 Write property test for evidence report with AI unavailable
    - **Property 6: Evidence report is complete and timestamped when AI is unavailable**
    - **Validates: Requirements 6.8, 9.2, 9.4, 7.5**

- [ ] 6. Implement API scan route
  - [ ] 6.1 Implement POST /api/scan route (Edge Runtime)
    - Create `app/api/scan/route.ts` as an Edge Runtime POST handler
    - Validate input: return 400 `{ "error": "input_required" }` if empty-after-trim, 400 `{ "error": "input_too_long" }` if length exceeds 10000
    - Run deterministic checks to completion first, then run AI interpretation, then combine via scoring
    - If AI is unavailable (timeout or error), complete scan with deterministic results only; set `aiAvailable: false` and `aiUnavailableReason`
    - Derive `inputType` from whether URLs were found in the input
    - Return 200 with full `ScanResult` JSON (timestamp, inputType, riskScore, severityTier, waxSealColor, deterministicFindings, aiFindings, recommendedSteps, aiAvailable, aiUnavailableReason, disclaimer)
    - No logging of user input, URLs, or scan results; return sanitized error responses on unexpected errors without echoing user data
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 6.8, 8.2, 8.4, 8.5, 11.1_

- [ ] 7. Implement theme and scanner input UI components
  - [ ] 7.1 Implement Header component
    - Create `components/theme/Header.tsx` with Moonlit Midnight (#0D1117) background
    - Render decorative crescent moon and bat motif behind header text with `aria-hidden="true"` and low opacity so text stays distinguishable
    - _Requirements: 2.1_

  - [ ] 7.2 Implement SpiderwebCorners component
    - Create `components/theme/SpiderwebCorners.tsx` with decorative geometric SVG corner accents
    - Set `aria-hidden="true"`, `pointer-events: none`; position to not overlap input or results areas
    - _Requirements: 2.4_

  - [ ] 7.3 Implement ScannerInput component
    - Create `components/scanner/ScannerInput.tsx` with `<textarea>` capped at 10,000 characters
    - Display live character counter
    - Render Pumpkin Orange (#FF5A1F) submit button
    - Client-side validation: inline "input required" message on empty submit (retain content, block scan); inline "maximum input length exceeded" message on paste exceeding limit
    - All controls keyboard-accessible with visible focus states
    - _Requirements: 1.1, 1.5, 1.6, 2.3, 2.7_

  - [ ] 7.4 Implement SampleTrapButtons component
    - Create `components/scanner/SampleTrapButtons.tsx` with three buttons: "Fake Remote Job DM", "Phishing Payment Link", "Legitimate Bank Alert"
    - Clicking a button replaces any existing textarea content with the corresponding synthetic sample string
    - All buttons keyboard-accessible with visible focus states
    - _Requirements: 1.2, 1.3, 2.7_

  - [ ] 7.5 Implement LoadingState component
    - Create `components/scanner/LoadingState.tsx` with a simple visible loading indicator
    - Display text "Inspecting message and links…" while the POST request is in flight
    - Clear on response (success, error, or unavailable handled by result rendering)
    - Do not display individual deterministic-check completion updates (single request/response flow)
    - _Requirements: 2.8, 3.2_

- [ ] 8. Implement results, export, advisory, and roadmap UI components
  - [ ] 8.1 Implement VerifiedChecks component
    - Create `components/scanner/VerifiedChecks.tsx` rendering only deterministic findings
    - Display a visible heading identifying evidence type as deterministic
    - Render each finding as a discrete item with label identifying the check type and affected URL, and evidence value stating the outcome
    - _Requirements: 4.5, 7.1, 7.3_

  - [ ] 8.2 Implement AiInterpretation component
    - Create `components/scanner/AiInterpretation.tsx` rendering only AI findings
    - Display a visible heading identifying evidence type as AI-generated
    - Show explicit "AI analysis unavailable" notice when AI is unavailable; never display fabricated AI findings
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ] 8.3 Implement WaxSealVerdict component
    - Create `components/scanner/WaxSealVerdict.tsx` rendering a wax-seal-style stamp
    - Display Severity_Tier and Risk_Score; color per tier (Crimson Wax #DC2626 for TRAP DETECTED, Candlelight Gold #D97706 for Caution, Potion Emerald #059669 for Low risk)
    - Never render "Verified Safe" or any wording claiming the input is definitively safe
    - Display itemized evidence supporting the Risk_Score alongside the stamp
    - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.7_

  - [ ] 8.4 Implement EvidenceReportExport component
    - Create `components/scanner/EvidenceReportExport.tsx` with "Copy Evidence Report" and "Download Report (.md)" buttons
    - Copy button copies full report text to system clipboard and shows confirmation indicating copy succeeded
    - Download button triggers Markdown file download with timestamped filename
    - Disable both buttons until a scan has completed
    - On copy or download failure, show error notice and preserve the Evidence_Report so the user can retry
    - All controls keyboard-accessible with visible focus states
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

  - [ ] 8.5 Implement AdvisoryDisclaimer component
    - Create `components/scanner/AdvisoryDisclaimer.tsx` rendering advisory disclaimer banner
    - Display text stating Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice
    - _Requirements: 8.1_

  - [ ] 8.6 Implement RoadmapSection component
    - Create `components/roadmap/RoadmapSection.tsx` with "Coming Soon — Product Roadmap" heading
    - Display "Contract & Lease PDF X-Ray" and "Subscription Drain Hunter" as distinct roadmap items showing their title text
    - No implementation of contract/lease PDF parsing, bank-statement analysis, or subscription-drain detection functionality
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 9. Assemble page and wire components together
  - [ ] 9.1 Create sample traps data
    - Create `lib/samples/sampleTraps.ts` with three synthetic sample strings
    - "Fake Remote Job DM": fictional remote job scam message with fictional names and URLs
    - "Phishing Payment Link": fictional phishing payment message with placeholder financial details
    - "Legitimate Bank Alert": fictional bank alert that produces a low-risk result with no fabricated AI findings and displays independent-verification guidance
    - Use only fictional names, fictional URLs, and placeholder financial details; no real personal, banking, or victim data
    - Do not imply through the "Legitimate Bank Alert" sample or any sample that any bank message is automatically safe
    - _Requirements: 1.2, 1.3, 1.7, 1.8_

  - [ ] 9.2 Implement ScannerCard composition
    - Create `components/scanner/ScannerCard.tsx` as a Warm Aged Parchment (#F8F3E6) card with dark ink (#1A1614) text
    - Compose ScannerInput, SampleTrapButtons, LoadingState, SpiderwebCorners, VerifiedChecks, AiInterpretation, WaxSealVerdict, and EvidenceReportExport
    - Ensure decorative spiderweb corners do not overlap the scan input field or results display area
    - _Requirements: 2.2, 2.4_

  - [ ] 9.3 Create root layout
    - Create `app/layout.tsx` with root layout, theme fonts, and global Tailwind styles
    - Include Header component and AdvisoryDisclaimer
    - _Requirements: 2.1, 2.2, 8.1_

  - [ ] 9.4 Create main page and wire scan flow
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

- [ ] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Write integration, component, and compliance tests
  - [ ]* 11.1 Write scan route integration tests
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

  - [ ]* 11.2 Write component tests with React Testing Library
    - Assert sample buttons replace textarea content
    - Assert empty submit shows inline validation and does not call the API
    - Assert loading indicator appears during scan and clears on response
    - Assert Verified Checks renders only deterministic findings; AI Interpretation renders only AI findings
    - Assert Wax-Seal shows correct tier, color, and score
    - Assert Copy/Download disabled until scan completes, enabled after
    - Assert export failure shows notice and preserves report for retry
    - Assert all primary controls are keyboard-reachable and activatable with visible focus
    - Assert "Legitimate Bank Alert" sample yields low-risk result with no fabricated AI findings and independent-verification guidance (mocked AI)
    - Assert advisory disclaimer and section headings are present
    - Assert "Coming Soon" roadmap section and two item titles render
    - _Requirements: 1.2, 1.3, 1.5, 1.7, 2.7, 2.8, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 9.1, 9.5, 9.6, 10.1, 10.2_

  - [ ]* 11.3 Write smoke and compliance tests
    - Validate data-file schemas: each JSON has `version`, `source`, `date`, and a non-empty list
    - Assert `.env.example` exists and lists every required env var with clearly-placeholder values
    - Assert `.gitignore` includes `.env.local` and keeps `.kiro/` tracked
    - Assert no literal secrets in committed source (secret-pattern scan)
    - Assert `LICENSE` contains MIT text
    - Assert no contract-PDF, bank-statement, or subscription-drain modules exist in the codebase
    - Assert build succeeds without those modules
    - _Requirements: 4.10, 10.3, 11.1, 11.3, 11.4, 11.5, 11.6_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

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
