import type { SampleTrap } from "@/components/scanner/SampleTrapButtons";

/**
 * Synthetic demo samples (Task 9.1).
 *
 * - Names, organizations, and accounts are fictional.
 * - Amounts are placeholders ("$XX.XX"); account numbers are placeholders.
 * - URLs use only reserved .example / .test domains. No real shortener or
 *   third-party domain is used, so no shortener or elevated-attention TLD
 *   finding can come from these samples.
 * - "Legitimate Bank Alert" models a routine-looking notice that itself tells
 *   the reader to verify through the official app or the number on their card.
 *   It is not a claim that bank messages are trustworthy: a low score still
 *   means "verify independently".
 *
 * Expected deterministic outcomes are asserted in sampleTraps.test.ts.
 */
export const SAMPLE_TRAPS: readonly SampleTrap[] = Object.freeze([
  {
    id: "fake-remote-job-dm",
    label: "Fake Remote Job DM",
    content:
      "Hi! I'm Jordan Vale, a recruiter at Example Talent Partners (fictional). " +
      "We have a work from home data-entry role for you. " +
      "To activate your account, pay the registration fee of $XX.XX today. " +
      "Act now, only 3 seats left. WhatsApp me for the next steps or apply at " +
      "https://careers-portal.example/apply",
  },
  {
    id: "phishing-payment-link",
    label: "Phishing Payment Link",
    content:
      "FINAL NOTICE from Example Pay Services (fictional): a payment of $XX.XX to your account is on hold. " +
      "Verify your identity at http://examplepay-billing.test/verify " +
      "and settle the processing fee of $XX.XX to release it.",
  },
  {
    id: "legitimate-bank-alert",
    label: "Legitimate Bank Alert",
    content:
      "Example Bank (fictional): A card payment of $XX.XX to Example Grocery was recorded on your account ending 0000. " +
      "If you do not recognise this payment, do not reply to this message and do not use any link in it. " +
      "Open the official Example Bank app, or call the number printed on the back of your card, to check your account.",
  },
]);
