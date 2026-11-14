import { describe, expect, it } from "vitest";
import realSet from "@/data/scamTriggers.json";
import { SCORING_WEIGHTS } from "@/lib/constants";
import { detectScamTriggers } from "./scamTriggerDetector";
import type { ScamTriggerSet } from "./types";

const set = realSet as ScamTriggerSet;

// Clearly synthetic set: proves the detector does not hardcode categories.
const syntheticSet: ScamTriggerSet = {
  version: "TEST-9.9",
  source: "synthetic-test-source",
  date: "2000-02-03",
  categories: [
    { id: "synthetic_b", label: "synthetic B", phrases: ["zorp blip"] },
    { id: "synthetic_a", label: "synthetic A", phrases: ["quux", "(a+)+"] },
  ],
};

describe("detectScamTriggers", () => {
  it("returns [] when nothing matches", () => {
    expect(detectScamTriggers("Hi, lunch tomorrow at noon?", set)).toEqual([]);
  });

  it("returns [] for empty or whitespace input", () => {
    expect(detectScamTriggers("", set)).toEqual([]);
    expect(detectScamTriggers("  \n\t ", set)).toEqual([]);
  });

  for (const category of set.categories) {
    it(`matches category ${category.id} via a real phrase`, () => {
      const phrase = category.phrases[0];
      const findings = detectScamTriggers(`Hello. ${phrase}. Thanks.`, set);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        id: `scam_trigger:${category.id}`,
        source: "deterministic",
        check: "scam_triggers",
        category: category.id,
        label: category.label,
        matchedText: phrase,
        severity: "medium",
        weight: SCORING_WEIGHTS.deterministic.scam_trigger_each,
      });
      expect(findings[0].evidence).toContain(phrase);
    });
  }

  it("emits one finding for multiple phrases of the same category", () => {
    const f = detectScamTriggers(
      "Pay a fee now. Also a processing fee and registration fee.",
      set,
    );
    const upfront = f.filter((x) => x.category === "upfront_payment");
    expect(upfront).toHaveLength(1);
    expect(upfront[0].matchedText).toBe("Pay a fee");
    expect(upfront[0].evidence).toContain("3 distinct");
    expect(upfront[0].evidence).toContain("processing fee");
  });

  it("emits one finding for a repeated phrase", () => {
    const f = detectScamTriggers("processing fee, processing fee, processing fee", set);
    expect(f).toHaveLength(1);
    expect(f[0].evidence).not.toContain("distinct");
  });

  it("emits one finding per category in set order", () => {
    const f = detectScamTriggers(
      "Send bitcoin today, share your OTP, and pay a fee. Work from home!",
      set,
    );
    expect(f.map((x) => x.category)).toEqual([
      "upfront_payment",
      "credential_request",
      "crypto_payment_demand",
      "suspicious_job_offer",
    ]);
  });

  it("is case-insensitive and preserves original casing", () => {
    const f = detectScamTriggers("Please SHARE   Your\nOtp now", set);
    expect(f).toHaveLength(1);
    expect(f[0].matchedText).toBe("SHARE   Your\nOtp");
  });

  it("respects word boundaries", () => {
    expect(detectScamTriggers("The insurgent group", set)).toEqual([]);
    expect(detectScamTriggers("URGENT: reply", set)[0].category).toBe(
      "urgency_pressure",
    );
  });

  it("matches curly apostrophes", () => {
    const f = detectScamTriggers("Please don\u2019t delay.", set);
    expect(f).toHaveLength(1);
    expect(f[0].category).toBe("urgency_pressure");
    expect(f[0].matchedText).toBe("don\u2019t delay");
  });

  it("cites the passed set's metadata", () => {
    const f = detectScamTriggers("zorp blip", syntheticSet);
    expect(f[0].reference).toBe(
      "scamTriggers.json vTEST-9.9 (synthetic-test-source, 2000-02-03)",
    );
  });

  it("honors a synthetic set (no hardcoded categories) in set order", () => {
    const f = detectScamTriggers("quux and (a+)+ then Zorp  Blip", syntheticSet);
    expect(f.map((x) => x.category)).toEqual(["synthetic_b", "synthetic_a"]);
    expect(f[1].evidence).toContain("2 distinct");
    expect(detectScamTriggers("pay a fee", syntheticSet)).toEqual([]);
  });

  it("is deterministic", () => {
    const input = "Urgent! Send bitcoin, don't delay, pay a fee.";
    expect(detectScamTriggers(input, set)).toEqual(detectScamTriggers(input, set));
  });
});
