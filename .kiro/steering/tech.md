---
inclusion: always
---
# Technical Guardrails & Kiroween Rules — Scryvorn

## Stack
- Next.js App Router, TypeScript, and Tailwind CSS.
- Keep deterministic checks in `/lib/checks/`.
- Keep AI/LLM interpretation in `/lib/ai/`.
- Keep UI components modular and avoid mixing business logic into components.

## Core User Flow
1. User pastes a message and/or URL, or selects a sample trap.
2. App runs deterministic checks first.
3. App runs AI interpretation only after deterministic checks.
4. App combines both into one risk assessment.
5. User can copy or download an Evidence Report.

## Report Requirements
- Support one-click “Copy Evidence Report.”
- Support download as `.txt` or `.md`.
- Include scan timestamp, input type, risk score, severity, evidence items, verification status, recommended actions, and an advisory disclaimer.
- The report must remain useful even if AI analysis is unavailable.

## Compliance
- Keep `.kiro/specs/`, `.kiro/steering/`, and `.kiro/hooks/` tracked in GitHub; never add them to `.gitignore`.
- Never hardcode API keys or secrets.
- Use `.env.local` for local secrets and provide `.env.example` with placeholder values.
- Public repository must include an MIT license.
- Include three one-click sample buttons: “Fake Remote Job DM,” “Phishing Payment Link,” and “Legitimate Bank Alert.”
- Ensure the app is deployable to Cloudflare Pages and does not depend on local-only files or uncommitted secrets.