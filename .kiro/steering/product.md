---
inclusion: always
---
# Product Vision & Steering Rules — Scryvorn

## Product Overview
Scryvorn is an AI-powered scam-message and suspicious-link forensics scanner for Kiroween 2026. It helps users examine suspicious WhatsApp/Telegram messages, job offers, payment requests, and URLs before clicking, replying, or sending money.

## Strict MVP Scope
IN SCOPE:
- Paste a suspicious message and/or URL.
- Run deterministic text and URL checks.
- Run AI-based interpretation of social-engineering patterns.
- Display a 0–100 Risk Score, severity tier, itemized evidence, and recommended next steps.
- Separate Verified Checks from AI Interpretation.
- Let users copy or download an Evidence Report (PDF or plain text).
- Saved Investigations, stored only in the user's own browser (see "Disclosed exception" below).

OUT OF SCOPE:
- Do not build contract/lease PDF scanning. (Generating the Evidence Report as a PDF is an export, not PDF scanning, and is in scope.)
- Do not build bank-statement or subscription-analysis features.
- Do not build user accounts, payments, databases, or server-side message-history storage. The only stored history is Saved Investigations in the user's own browser.
- Show contract scanning and subscription detection only as “Coming Soon” roadmap items on the landing page.

## Disclosed exception: Saved Investigations
Decision (approved for Kiroween judging): judges must be able to test SCRYVORN, leave, return, and still see what they examined, without signing in.
- Storage: the browser's localStorage only (key `scryvorn.savedInvestigations.v1`), through `lib/storage/savedInvestigations.ts`, the only module that touches Web Storage. Nothing is sent to or stored on a server; there are no accounts.
- What is saved: each completed investigation, automatically: the submitted message or URL, the full scan result (findings, AI interpretation, risk score, tier, timestamps), the plain-text Evidence Report, and the time it was saved. At most 25 entries; the oldest is dropped first.
- Disclosure: a visible notice beside the input and in the Saved Investigations panel states that investigations, including the submitted text, are saved only in the current browser, are not sent anywhere, and stay until deleted.
- Control: each entry can be opened or deleted; "Clear all" (with confirmation) removes every entry.
- Limits: another browser or device, private browsing, or clearing site data starts empty. Corrupted or tampered entries are skipped, never rendered.
- No other state (cookies, sessionStorage, IndexedDB, server storage) is persisted.

## Definition of Done — “No Evidence, No Verdict”
A scan or Kiro task is complete only when:
1. It works in the deployed web app, not only locally.
2. The UI shows a 0–100 Risk Score, severity tier, itemized evidence, and recommended next steps.
3. Every material claim has visible support: quoted suspicious text, URL/domain check output, or a clearly stated rule.
4. Deterministic checks are visually separated from AI interpretation.
5. The app handles empty input, invalid URLs, API failures, and rate limits gracefully.
6. No API keys, secrets, or real user data are committed to the repository.

## Trust and Safety Rules
- Never state that a message or link is definitively safe.
- Use “Low risk — still verify independently” rather than “Verified Safe.”
- Clearly label the output as advisory guidance, not financial, legal, or law-enforcement advice.
- Do not retain message text, URLs, screenshots, or scan results unless a deliberate, clearly disclosed feature requires it. Saved Investigations (browser-only, disclosed, deletable) is the one such feature.
- Use only synthetic sample data in the demo.

## UI Direction — Haunted Victorian Forensic Laboratory (Halloween edition)
(Replaces the earlier "Autumn Lantern & Enchanted Casebook" direction, which used Moonlit Midnight, Warm Aged Parchment, dark ink, Pumpkin Orange, Crimson Wax, Potion Emerald, and Candlelight Gold.)
- A dark gothic cathedral combined with a Victorian monster laboratory and a serious forensic investigation console: cinematic and unmistakably Halloween, but never cartoonish. No cartoon pumpkins, emoji, dripping fonts, or clipart.
- Palette: background #070709, card #110D0F, border rgba(155,38,38,0.28), primary crimson #9B2626, pumpkin amber #E8892B, laboratory green #4ADE80 / #2F8F5B, ivory text #EAE2D6, muted text #A79F94, danger #B91C1C, success #15803D.
- Crimson marks danger and verdicts; amber marks atmosphere, investigation, and active states; green marks laboratory energy and AI interpretation. Never put dark text on dark backgrounds; tier text is always ivory.
- Typography: Cormorant Garamond for serif headings and Inter for body text (next/font, with system fallbacks).
- Decorations (cathedral with gothic corner tracery and stone gargoyles, jack-o'-lanterns, small panel-corner cobwebs, tarantula in a dedicated lower lane, descending spider, ghosts on both sides, bats on independent flight paths, candles, fog, green lab energy during loading; no caped vampire figures) are aria-hidden, ignore pointer input, never cover controls, text, findings, or focus indicators, never cause horizontal scrolling, respect prefers-reduced-motion, and never flash rapidly.
- Routes: landing page at `/`, inspection app at `/inspect`; every "Examine a message" call to action links to `/inspect`.
- Never show a fixed verdict ("High risk. Do not engage." or similar). Show only the real Severity_Tier and score from an actual scan result, and only after the scan completes.
- Prioritize readability, accessibility, and mobile usability over decorative effects.