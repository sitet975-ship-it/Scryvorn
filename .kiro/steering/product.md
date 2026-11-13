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
- Let users copy or download an Evidence Report.

OUT OF SCOPE:
- Do not build contract/lease PDF scanning.
- Do not build bank-statement or subscription-analysis features.
- Do not build user accounts, payments, databases, or message-history storage.
- Show contract scanning and subscription detection only as “Coming Soon” roadmap items on the landing page.

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
- Do not retain message text, URLs, screenshots, or scan results unless a deliberate, clearly disclosed feature requires it.
- Use only synthetic sample data in the demo.

## UI Direction — Autumn Lantern & Enchanted Casebook
- Avoid cartoon ghosts and generic gray dashboards.
- Use Moonlit Midnight (#0D1117), Warm Aged Parchment (#F8F3E6), dark ink (#1A1614), Pumpkin Orange (#FF5A1F), Crimson Wax (#DC2626), Potion Emerald (#059669), and Candlelight Gold (#D97706).
- Use subtle geometric spiderweb accents, a crescent moon/bat navbar motif, and readable wax-seal-style verdict stamps.
- Prioritize readability, accessibility, and mobile usability over decorative effects.