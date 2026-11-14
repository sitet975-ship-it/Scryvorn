# Scryvorn
AI-powered Scam-Message &amp; Suspicious-Link Forensics Scanner built for Kiroween 2026.

## Deployment

Scryvorn deploys to Netlify using Netlify's built-in Next.js support. The scan API route runs on the standard Next.js Node.js runtime, not the Edge Runtime.

- Set `AI_API_KEY`, `AI_API_BASE_URL`, and `AI_MODEL` as Netlify environment variables available to functions (UI, CLI, or API). Do not put them in `netlify.toml`; variables declared there are not available to functions. Redeploy after changing them.
- For local development, copy `.env.example` to `.env.local` and fill in your own values.
- Netlify synchronous functions have a 60-second execution limit that is not configurable. The AI request timeout is 30 seconds; real request latency has not been measured yet.
- Do not enable a production domain-age lookup service until a bounded lookup policy is approved.

Node.js 24 is pinned for Netlify builds through `.nvmrc`. Local development may use a different version (currently Node 26), so local and Netlify behavior can differ.
