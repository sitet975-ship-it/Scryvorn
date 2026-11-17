import { describe, expect, it } from "vitest";
import type { CheckName } from "@/lib/checks/types";
import { SOURCE_LABELS, deterministicSource } from "./provenance";

describe("provenance", () => {
  it("maps scam-trigger rules to message rules and every URL check to link checks", () => {
    expect(deterministicSource("scam_triggers")).toBe("message_rules");
    const urlChecks: CheckName[] = ["url_extraction", "https_status", "shortener", "domain_heuristic", "domain_age"];
    for (const c of urlChecks) expect(deterministicSource(c), c).toBe("link_checks");
  });

  it("has fixed labels for each source", () => {
    expect(SOURCE_LABELS).toEqual({
      message_rules: "Message rules",
      link_checks: "Link checks",
      ai_interpretation: "AI interpretation",
    });
  });
});
