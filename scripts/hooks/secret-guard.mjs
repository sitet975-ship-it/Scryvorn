#!/usr/bin/env node
// Kiro PreToolUse hook (.kiro/hooks/secret-guard.json).
//
// Reads the pending tool call (JSON on stdin) and blocks it with exit code 2
// if the content looks like a real credential: Groq, OpenAI, AWS, GitHub, npm,
// Netlify, or Slack tokens, or a private key. Scryvorn's rule: secrets live in
// .env.local or Netlify environment variables, never in the repository.
//
// The obviously fake test keys used by the test suite (they contain hyphens
// right after the prefix) do not match. Nothing is logged except the name of
// the matched pattern.

const PATTERNS = [
  ["Groq API key", /\bgsk_[A-Za-z0-9]{20,}/],
  ["OpenAI-style API key", /\bsk-(?:proj-)?[A-Za-z0-9]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,}/],
  ["Netlify token", /\bnfp_[A-Za-z0-9]{20,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  // Built from parts so this file never contains the literal marker itself.
  ["private key", new RegExp("-----BEGIN [A-Z ]*PRIVATE " + "KEY-----")],
];

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  // The JSON is scanned as text, so the check does not depend on field names.
  for (const [name, re] of PATTERNS) {
    if (re.test(input)) {
      process.stderr.write(
        `Blocked by secret-guard: this change appears to contain a ${name}. ` +
          "Put secrets in .env.local (local) or Netlify environment variables (production), never in the repository.\n",
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
