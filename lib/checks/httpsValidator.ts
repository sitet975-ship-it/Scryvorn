import { SCORING_WEIGHTS } from "@/lib/constants";
import type { DeterministicFinding } from "@/lib/checks/types";

/**
 * Records whether a URL uses the HTTPS scheme. Informational only:
 * the finding always has weight 0 and never implies a link is safe or unsafe.
 * Pure and deterministic; performs no network access.
 */
export function checkHttps(url: string): DeterministicFinding {
  let protocol: string | null = null;
  try {
    protocol = new URL(url).protocol.toLowerCase();
  } catch {
    protocol = null;
  }

  let evidence: string;
  if (protocol === null) {
    evidence =
      "Could not determine the URL scheme. This is informational and not evidence of a scam.";
  } else if (protocol === "https:") {
    evidence =
      "Uses HTTPS (encrypted connection). HTTPS alone does not indicate a link is trustworthy.";
  } else {
    evidence = "Does not use HTTPS. This alone is not evidence of a scam.";
  }

  return {
    id: `https_status:${url}`,
    source: "deterministic",
    check: "https_status",
    category: "https_status",
    label: `HTTPS status for ${url}`,
    evidence,
    url,
    severity: "info",
    weight: SCORING_WEIGHTS.deterministic.https_status,
  };
}
