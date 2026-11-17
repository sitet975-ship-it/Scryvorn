# Requirements Document

## Introduction

Scryvorn is an AI-powered scam-message and suspicious-link forensics scanner built for Kiroween 2026. It lets a user paste a suspicious message and/or URL, then runs a two-layer pipeline — deterministic checks first, AI interpretation second — and presents a 0–100 Risk_Score, a Severity_Tier, itemized evidence, and recommended next steps. The application separates verified deterministic findings from AI interpretation, never claims a message or link is definitively safe, and produces an exportable Evidence_Report that remains useful even when external services are unavailable. The MVP scope is limited to the message-and-URL scanner; contract/lease PDF scanning and bank-statement analysis are out of scope and shown only as roadmap items.

## Glossary

- **Scryvorn**: The Next.js web application that performs scam-message and suspicious-link forensics scanning.
- **Scanner_Input**: The message text and/or URL that a user pastes into Scryvorn for analysis.
- **Deterministic_Check_Engine**: The module in `/lib/checks/` that runs rule-based, non-AI verification of the Scanner_Input.
- **AI_Interpretation_Engine**: The module in `/lib/ai/` that runs LLM-based interpretation of social-engineering patterns in the Scanner_Input.
- **Risk_Score**: An integer from 0 to 100 that quantifies the assessed risk of the Scanner_Input.
- **Severity_Tier**: A categorical label assigned based on the Risk_Score, displayed as a wax-seal-style stamp.
- **Verified_Checks**: The UI section displaying deterministic check results, visually separated from AI interpretation.
- **AI_Interpretation**: The UI section displaying AI-based interpretation results, visually separated from Verified Checks.
- **Evidence_Report**: The exportable artifact containing the full scan result and advisory disclaimer.
- **Sample_Trap**: A one-click button that auto-fills a synthetic example Scanner_Input.
- **Wax_Seal_Stamp**: The visual verdict stamp rendered on a completed scan showing the Severity_Tier and Risk_Score.
- **Candlelight_Gold**: A thematic color (#D97706) originally used for the "Caution — verify before acting" Severity_Tier Wax_Seal_Stamp; replaced by pumpkin amber (#E8892B) in the Halloween redesign (see Requirement 6).
- **URL_Extractor**: The component that identifies and extracts URLs from message text within the Deterministic_Check_Engine.
- **HTTPS_Validator**: The component that checks whether an extracted URL uses the HTTPS scheme within the Deterministic_Check_Engine.
- **Shortener_Detector**: The component that identifies URL-shortener domains within the Deterministic_Check_Engine.
- **Domain_Heuristic**: The component that flags suspicious TLDs and lookalike domains within the Deterministic_Check_Engine.
- **Scam_Trigger_Detector**: The component that detects scam-trigger phrases within the Deterministic_Check_Engine.

## Requirements

### Requirement 1: Scanner Input and Synthetic Sample Traps

**User Story:** As a user, I want to paste a suspicious message and/or URL, or select a synthetic sample, so that I can run a forensics scan without exposing real personal or victim data.

#### Acceptance Criteria

1. THE Scryvorn SHALL provide a text input area with a maximum capacity of 10,000 characters where a user can paste a Scanner_Input consisting of message text and/or a URL.
2. THE Scryvorn SHALL display three one-click Sample_Trap buttons labeled "Fake Remote Job DM," "Phishing Payment Link," and "Legitimate Bank Alert."
3. WHEN a Sample_Trap button is clicked, THE Scryvorn SHALL replace any existing content in the text input area with a synthetic example Scanner_Input containing no real personal, banking, or victim data, using only fictional names, fictional URLs, and placeholder financial details.
4. WHEN the user clicks a submit button to submit the Scanner_Input, THE Scryvorn SHALL run a scan using the content of the text input area.
5. IF the user submits an empty Scanner_Input, THEN THE Scryvorn SHALL display an inline validation message adjacent to the text input area indicating that input is required, SHALL retain any existing content in the text input area, and SHALL NOT run the scan.
6. IF the user attempts to paste a Scanner_Input exceeding 10,000 characters, THEN THE Scryvorn SHALL display an inline message adjacent to the text input area indicating the maximum input length has been exceeded.
7. WHEN the "Legitimate Bank Alert" Sample_Trap is used, THE Scryvorn SHALL produce a low-risk result with no fabricated AI findings and SHALL display independent-verification guidance.
8. THE Scryvorn SHALL NOT imply through the "Legitimate Bank Alert" Sample_Trap or any sample that any bank message is automatically safe.

### Requirement 2: Autumn Lantern & Enchanted Casebook UI

**User Story:** As a user, I want a themed, readable, accessible interface, so that the scan experience is engaging and usable across devices.

#### Acceptance Criteria

*(Revised in the Halloween forensic-laboratory redesign. Criteria 1–4 originally specified a Moonlit Midnight #0D1117 header with a moon-and-bat motif, a Warm Aged Parchment #F8F3E6 card with dark ink #1A1614 text, a Pumpkin Orange #FF5A1F submit button labelled "Inspect for Traps", and spiderweb corner accents; those were implemented in Tasks 7–9 and later replaced.)*

1. THE Scryvorn SHALL render a top navigation on the #070709 background with the "✧ SCRYVORN" brand on the left (the ✧ glyph decorative) and "How it works" and "About" links on the right, and SHALL render a decorative, non-interactive Halloween backdrop (gothic cathedral, jack-o'-lanterns, cobwebs, a tarantula in a dedicated lower lane, a descending spider, ghosts, bats, candles, fog, and a distant vampire silhouette) behind all content.
2. THE Scryvorn SHALL render content panels on the card background (#110D0F) with ivory (#EAE2D6) or muted (#A79F94) text, crimson-tinted borders (rgba(155,38,38,0.28)), and ivory serif headings (Cormorant Garamond with system serif fallbacks; Inter with system sans fallbacks for body text).
3. THE Scryvorn SHALL render the primary scan-submit button labelled "Examine the evidence →" (the arrow decorative) in primary crimson (#9B2626) with ivory text and an amber (#E8892B) glow, at a large tap-target size.
4. Decorative Halloween elements SHALL be aria-hidden, not focusable, and ignore pointer input; SHALL NOT overlap or obscure interactive controls, text, findings, or focus indicators; SHALL NOT cause horizontal scrolling; SHALL be still under prefers-reduced-motion: reduce; and SHALL NOT flash rapidly. Crimson marks danger and verdicts, amber marks atmosphere and active states, and laboratory green (#4ADE80 / #2F8F5B) marks laboratory energy and AI interpretation.
5. THE Scryvorn SHALL meet WCAG AA color-contrast ratios (4.5:1 for normal text, 3:1 for large text) for all text rendered on themed backgrounds.
6. THE Scryvorn SHALL provide a responsive layout in which all content and interactive elements remain visible and operable without horizontal scrolling at minimum viewport widths of 360px (mobile), 768px (tablet), and 1024px (desktop).
7. THE Scryvorn SHALL ensure all Sample_Trap buttons, text input, submit, copy, and download controls are fully operable via keyboard.
8. THE Scryvorn SHALL display a visible loading indicator during analysis and SHALL display clear success, error, and unavailable-service states.

### Requirement 3: Two-Layer Forensics Pipeline Execution Order

**User Story:** As a user, I want deterministic checks to run before AI interpretation, so that verified evidence is always produced even when the AI service is unavailable.

#### Acceptance Criteria

1. WHEN a user submits a Scanner_Input, THE Scryvorn SHALL first run the Deterministic_Check_Engine to completion on the Scanner_Input before initiating any AI_Interpretation_Engine processing.
2. WHILE the POST /api/scan request is in progress, THE Scryvorn SHALL display a clear visible loading indicator with text such as 'Inspecting message and links…'. THE Scryvorn SHALL NOT claim or display individual deterministic-check completion updates because the scan uses a single request/response flow.
3. WHEN the Deterministic_Check_Engine completes successfully, THE Scryvorn SHALL then run the AI_Interpretation_Engine on the Scanner_Input.
4. IF the AI_Interpretation_Engine does not respond within 30 seconds or returns an error, THEN THE Scryvorn SHALL complete the scan using the Deterministic_Check_Engine results without rolling back those results, and SHALL display a notice indicating that AI analysis is unavailable.
5. WHEN the scan completes successfully, THE Scryvorn SHALL display a clear success state showing the combined scan results.
6. IF the scan request fails or returns an error, THEN THE Scryvorn SHALL display a clear error state indicating the scan could not be completed.
7. IF the AI_Interpretation_Engine fails or times out, THEN THE Scryvorn SHALL display a clear 'AI analysis unavailable' state while still presenting the Deterministic_Check_Engine results.
8. THE Scryvorn SHALL ensure all interactive controls including sample buttons, text input, submit, copy, and download are keyboard accessible with visible focus states.

### Requirement 4: Deterministic URL and Domain Checks

**User Story:** As a user, I want verified checks on URLs and domains, so that I get reliable, non-AI evidence about suspicious links.

#### Acceptance Criteria

1. WHEN a Scanner_Input contains URLs, THE URL_Extractor SHALL extract every URL from the message text.
2. WHEN a URL is extracted, THE HTTPS_Validator SHALL record whether the URL uses the HTTPS scheme.
3. WHEN an extracted URL uses a known URL-shortener domain (a domain included in a maintained list of known URL-shortener service domains), THE Shortener_Detector SHALL flag the URL as shortened.
4. WHEN an extracted URL uses a suspicious TLD (a TLD included in a maintained list of elevated-attention TLDs) or a lookalike domain (a domain that closely resembles a known legitimate domain through character substitution, character omission, or typosquatting), THE Domain_Heuristic SHALL flag the URL and SHALL include the specific reason in the finding. A TLD match on the elevated-attention TLD list is informational context, not a high-risk verdict; matching a TLD on this list does not by itself imply a scam — it provides elevated-attention context that warrants further review.
5. THE Deterministic_Check_Engine SHALL report each URL finding as a discrete item that includes a label identifying the type of check performed and the affected URL, and an evidence value stating the outcome of that check.
6. WHERE a domain-age lookup service is configured, THE Deterministic_Check_Engine SHALL use the service to enrich domain findings with the domain's registration age as reported by the service.
7. IF the domain-age lookup service is not configured or fails to return a result due to service error, timeout, or unreachability, THEN THE Deterministic_Check_Engine SHALL complete the scan without domain-age data and SHALL note the absence in the findings.
8. THE Deterministic_Check_Engine SHALL NOT assign risk solely because a URL uses HTTPS or lacks HTTPS, and SHALL display HTTPS status as informational context only.
9. THE Deterministic_Check_Engine SHALL analyze URL structure and metadata only and SHALL NOT fetch, crawl, render, screenshot, or download content from user-supplied URLs.
10. THE Deterministic_Check_Engine SHALL store URL-shortener and elevated-attention TLD lists as versioned, reviewable data files in the repository, each with a source and date reference.
11. THE Deterministic_Check_Engine SHALL cite the relevant list version or reference in each finding based on a URL-shortener or elevated-attention TLD list.
12. WHEN the Domain_Heuristic flags a lookalike domain, THE Domain_Heuristic SHALL use conservative similarity rules, SHALL display the suspected legitimate domain and the specific similarity reason, and SHALL label low-confidence matches as "Needs manual verification" rather than asserting impersonation.
13. THE Deterministic_Check_Engine SHALL assign elevated-attention TLD findings a risk weight of 0, so that a TLD match alone does not change the Risk_Score or escalate the Severity_Tier.

> **Implementation status note:** lookalike comparison (4.4, 4.12) requires a reviewed known-legitimate-domain reference list, which is not yet supplied. Until it is supplied, lookalike checking is inactive and these criteria are not fully satisfied. In addition, the current comparison treats a hostname's last two labels as its registrable domain and does not handle multi-label public suffixes (for example `co.uk`), so it is not ready for general production activation. That handling must be reviewed and corrected before any production reference list is enabled.

### Requirement 5: Deterministic Scam-Trigger Phrase Detection

**User Story:** As a user, I want detection of common scam language patterns, so that I get reliable warnings about social-engineering tactics in messages.

#### Acceptance Criteria

1. WHEN the Scanner_Input contains a phrase matching the defined trigger phrase set for upfront payment requests, THE Scam_Trigger_Detector SHALL flag it as an "upfront payment request" trigger.
2. WHEN the Scanner_Input contains a phrase matching the defined trigger phrase set for credential requests covering OTP, PIN, or password, THE Scam_Trigger_Detector SHALL flag it as a "credential request" trigger.
3. WHEN the Scanner_Input contains a phrase matching the defined trigger phrase set for urgency pressure language, THE Scam_Trigger_Detector SHALL flag it as an "urgency pressure" trigger.
4. WHEN the Scanner_Input contains a phrase matching the defined trigger phrase set for off-platform move requests, THE Scam_Trigger_Detector SHALL flag it as an "off-platform move" trigger.
5. WHEN the Scanner_Input contains a phrase matching the defined trigger phrase set for cryptocurrency payment demands, THE Scam_Trigger_Detector SHALL flag it as a "crypto payment demand" trigger.
6. WHEN the Scanner_Input contains a phrase matching the defined trigger phrase set for suspicious job offers, THE Scam_Trigger_Detector SHALL flag it as a "suspicious job offer" trigger.
7. THE Scam_Trigger_Detector SHALL include the trigger category and the matched phrase text in each finding so the evidence is traceable.
8. THE Scam_Trigger_Detector SHALL match each Scanner_Input against the defined trigger phrase sets deterministically, such that identical Scanner_Input values always produce identical findings.
9. WHEN the Scanner_Input contains phrases matching more than one trigger category, THE Scam_Trigger_Detector SHALL produce a separate finding for each matching category.
10. IF the Scanner_Input contains no phrases matching any defined trigger phrase set, THEN THE Scam_Trigger_Detector SHALL produce no findings.

### Requirement 6: Risk Score and Severity Tier

**User Story:** As a user, I want a clear risk score and severity tier, so that I can quickly understand how risky the Scanner_Input is.

#### Acceptance Criteria

1. WHEN the Deterministic_Check_Engine completes its required checks, THE Scryvorn SHALL compute a Risk_Score as an integer in the range 0 to 100 from the combined Deterministic_Check_Engine and AI_Interpretation_Engine findings. (For an incomplete run, see criterion 9.)
2. IF the Risk_Score is in the range 70 to 100, THEN THE Scryvorn SHALL assign the Severity_Tier "TRAP DETECTED" and SHALL render the Wax_Seal_Stamp as "TRAP DETECTED" with a #B91C1C tier accent.
3. IF the Risk_Score is in the range 40 to 69, THEN THE Scryvorn SHALL assign the Severity_Tier "Caution — verify before acting" and SHALL render the Wax_Seal_Stamp as "Caution — verify before acting" with a #E8892B tier accent.
4. IF the Risk_Score is in the range 0 to 39, THEN THE Scryvorn SHALL assign the Severity_Tier "Low risk — still verify independently" and SHALL render the Wax_Seal_Stamp as "Low risk — still verify independently" with a #15803D tier accent.
   *(Revised in the Halloween redesign: tier accents were #DC2626 / #D97706 / #059669. The tier text itself SHALL always be rendered in ivory or another accessible light color; the accent color is supplementary. The displayed tier SHALL be the real Severity_Tier from the scan result; no fixed verdict wording SHALL be displayed.)*
5. THE Scryvorn SHALL derive the Risk_Score from the combined Deterministic_Check_Engine and AI_Interpretation_Engine findings and SHALL NOT manually adjust the Risk_Score to fit a desired Severity_Tier.
6. THE Scryvorn SHALL NOT render the label "Verified Safe" or any wording claiming the Scanner_Input is definitively safe.
7. THE Scryvorn SHALL display itemized evidence supporting the Risk_Score alongside the Wax_Seal_Stamp.
8. IF the AI_Interpretation_Engine is unavailable or returns an error, THEN THE Scryvorn SHALL compute the Risk_Score from Deterministic_Check_Engine findings alone.
9. IF the Deterministic_Check_Engine reports that its required checks did not complete, THEN THE Scryvorn SHALL NOT present the scan as a completed assessment, SHALL assign no Risk_Score, Severity_Tier, or Wax_Seal_Stamp color (it SHALL NOT substitute a higher tier or manufacture a score), SHALL state "Assessment incomplete — no overall risk score or tier assigned." in the UI and the Evidence_Report, SHALL list which required checks were not finished, and SHALL retain the evidence that was collected.
10. THE Scryvorn SHALL describe the Risk_Score as an uncalibrated heuristic score. THE Scryvorn SHALL NOT describe it as a probability, a verified fraud verdict, or a validated confidence estimate.

### Requirement 7: Separation of Verified Checks and AI Interpretation

**User Story:** As a user, I want verified checks and AI interpretation clearly separated, so that I can distinguish reliable rule-based evidence from AI-generated interpretation.

#### Acceptance Criteria

1. THE Scryvorn SHALL render a "Verified Checks" section containing only Deterministic_Check_Engine findings.
2. THE Scryvorn SHALL render a separate "AI Interpretation" section containing only AI_Interpretation_Engine findings.
3. THE Scryvorn SHALL render the "Verified Checks" and "AI Interpretation" sections as separate, non-interleaved UI areas, each with a visible heading that identifies its evidence type as deterministic or AI-generated.
4. IF the AI_Interpretation_Engine is unavailable, THEN THE Scryvorn SHALL render the "AI Interpretation" section with an explicit "AI analysis unavailable" notice.
5. IF the AI_Interpretation_Engine is unavailable, THEN THE Scryvorn SHALL NOT display fabricated AI findings in the "AI Interpretation" section.

### Requirement 8: Advisory Disclaimer and No Data Persistence

**User Story:** As a user, I want clear advisory framing and no data retention, so that I understand the output is guidance and my input is not stored.

#### Acceptance Criteria

1. WHEN the scan page is loaded, THE Scryvorn SHALL display an advisory disclaimer stating that Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice.
2. THE Scryvorn SHALL NOT persist user messages, URLs, screenshots, or scan results in any database or client-side storage, and SHALL retain them only in application memory for the duration of the scan page session, defined as the period from when the scan page is loaded until the user navigates away from or refreshes the scan page.
3. IF a user navigates away from or refreshes the scan page, THEN THE Scryvorn SHALL clear the current Scanner_Input and scan results from application memory.
4. THE Scryvorn SHALL NOT write user inputs, extracted URLs, scan results, or Evidence_Report contents to server logs, analytics services, databases, files, or third-party storage.
5. THE Scryvorn SHALL exclude all user-supplied message text, URLs, and scan results from operational error logs.

### Requirement 9: Exportable Evidence Report

**User Story:** As a user, I want to copy and download an evidence report, so that I can share or keep a record of the scan.

#### Acceptance Criteria

1. WHEN a user clicks the "Copy Evidence Report" button, THE Scryvorn SHALL copy the full Evidence_Report text to the system clipboard and SHALL display a confirmation indicating the copy succeeded.
2. WHEN a user clicks the "Download Report (.md)" button, THE Scryvorn SHALL download the Evidence_Report as a Markdown file whose filename includes the scan timestamp.
3. THE Evidence_Report SHALL include the scan timestamp, input type, Risk_Score and Severity_Tier (or, for an incomplete assessment, the incomplete notice from Requirement 6.9 in their place), deterministic findings, AI findings, recommended verification steps, and the advisory disclaimer.
4. WHEN the AI_Interpretation_Engine is unavailable, THE Evidence_Report SHALL include the deterministic findings and an explicit "AI analysis unavailable" notice, SHALL NOT display any supplied AI findings, and SHALL still be generated.
5. WHILE no scan has completed, THE Scryvorn SHALL NOT enable the "Copy Evidence Report" and "Download Report (.md)" buttons. *(Halloween redesign: the buttons are offered only in the "Evidence, preserved." view, which exists only after a completed scan; before that they are not rendered at all.)*
6. IF a copy or download operation fails, THEN THE Scryvorn SHALL display an error notice indicating the export failed and SHALL preserve the Evidence_Report so the user can retry.
7. THE Evidence_Report SHALL use these distinct sections, in order: "Assessment status and coverage", "Scored deterministic findings", "Informational context", "Checks not performed / unavailable", "AI interpretation", "Recommended verification steps", and "Advisory disclaimer". HTTPS status and elevated-attention TLD findings SHALL appear under "Informational context"; domain-age unavailability and interrupted required checks SHALL appear under "Checks not performed / unavailable". THE Evidence_Report SHALL NOT describe absent findings as proof of safety.
8. WHILE lookalike checking is inactive, THE Evidence_Report SHALL state "Lookalike checking was not performed because no reviewed reference list is configured. This is not a passed check." WHILE a reference list is configured, THE Evidence_Report SHALL describe lookalike checking as configured, not as proof that it ran.
9. THE Evidence_Report SHALL treat finding labels, evidence, matched text, URLs, AI text, and recommended steps as untrusted content: it SHALL escape Markdown and HTML syntax in them, SHALL defang URL and domain strings in them, and SHALL NOT emit raw HTML, Markdown links, images, or autolinks from them. Viewer-specific automatic linking cannot be guaranteed absent in every Markdown viewer.
10. THE Evidence_Report and its filename SHALL use the scan timestamp in UTC, with the filename `scryvorn-report-YYYYMMDD-HHmmss.md`. IF the scan timestamp is not a valid ISO 8601 date-time with an explicit UTC marker or numeric offset, THEN THE Scryvorn SHALL reject it with an error and SHALL NOT substitute the current time.
11. IF the AI_Interpretation_Engine is unavailable or returns no recommended steps, THEN THE Scryvorn SHALL use a fixed, reviewed list of fallback verification steps. All steps SHALL be labeled as recommendations for the user, not as verification Scryvorn performed, and THE Scryvorn SHALL NOT claim it visited or confirmed any destination.

### Requirement 10: Landing-Page Roadmap

**User Story:** As a visitor, I want to see planned features on the landing page, so that I know what is coming without those features being present in the app.

#### Acceptance Criteria

1. THE Scryvorn SHALL render a visible "Coming Soon — Product Roadmap" section on the landing page, with a heading displaying that text.
2. THE Scryvorn SHALL display "Contract & Lease PDF X-Ray" and "Subscription Drain Hunter" as distinct, visible roadmap items within that section, each item showing its title text.
3. THE Scryvorn SHALL NOT implement contract/lease PDF parsing, bank-statement analysis, or subscription-drain detection functionality in the application codebase; the roadmap item titles displayed in that section do not constitute such implementation.

### Requirement 11: Deployment and Secrets Compliance

**User Story:** As a maintainer, I want a deployable, secret-free codebase, so that the app can run on Netlify without leaking credentials.

#### Acceptance Criteria

1. WHEN the Scryvorn is deployed to Netlify, THE Scryvorn SHALL build successfully using only committed files and environment variables, without requiring local-only files or uncommitted secrets.
2. THE Scryvorn SHALL load all secrets from environment variables via `.env.local` during local development.
3. THE Scryvorn SHALL NOT contain API keys, tokens, passwords, or other credentials as literal string values in committed source files.
4. THE Scryvorn SHALL include a LICENSE file containing the standard MIT license text in the public repository.
5. THE Scryvorn SHALL provide a `.env.example` file listing every required environment variable with non-functional placeholder values that are clearly identifiable as examples.
6. THE Scryvorn SHALL list `.env.local` in `.gitignore` so that local secrets are not committed to version control.
7. THE scan API route SHALL run on the standard Next.js App Router Node.js runtime and SHALL NOT use the Edge Runtime.
8. THE scan API route SHALL complete within Netlify's synchronous function execution limit of 60 seconds, which is not configurable. THE 30-second AI timeout SHALL NOT be described as leaving a proven safety margin until a deploy-preview request has been measured.
9. IN production, THE Scryvorn SHALL read server secrets only from Netlify environment variables that are available to functions at runtime. Secrets SHALL NOT be declared in `netlify.toml`, because variables declared there are not available to functions.
10. THE Scryvorn SHALL NOT enable a production domain-age lookup service until an approved, bounded lookup policy exists (Design: "Domain-age lookup timing").

> **Implementation status note:** the former Cloudflare Pages adapter and its configuration have been removed. Node.js 24 is pinned for Netlify builds through `.nvmrc`; local development currently uses Node 26, and the pin does not guarantee identical behavior between the two.
