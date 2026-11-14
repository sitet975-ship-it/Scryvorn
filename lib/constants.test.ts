import { describe, it, expect } from "vitest";
import {
  ADVISORY_DISCLAIMER,
  AI_TIMEOUT_MS,
  INPUT_MAX_CHARS,
  SCORING_WEIGHTS,
  SEVERITY_TIERS,
  THEME,
} from "@/lib/constants";

const tierFor = (s: number) =>
  SEVERITY_TIERS.find((t) => t.min <= s && s <= t.max)?.tier;

describe("constants", () => {
  it("severity tiers cover 0..100 with no gaps or overlaps", () => {
    for (let s = 0; s <= 100; s++) {
      const matches = SEVERITY_TIERS.filter((t) => t.min <= s && s <= t.max);
      expect(matches).toHaveLength(1);
    }
  });

  it("maps boundary scores to the right tier", () => {
    expect(tierFor(0)).toBe("Low risk — still verify independently");
    expect(tierFor(39)).toBe("Low risk — still verify independently");
    expect(tierFor(40)).toBe("Caution — verify before acting");
    expect(tierFor(69)).toBe("Caution — verify before acting");
    expect(tierFor(70)).toBe("TRAP DETECTED");
    expect(tierFor(100)).toBe("TRAP DETECTED");
  });

  it("tier colors match the theme", () => {
    const colors = Object.fromEntries(SEVERITY_TIERS.map((t) => [t.min, t.color]));
    expect(colors[70]).toBe(THEME.crimsonWax);
    expect(colors[40]).toBe(THEME.candlelightGold);
    expect(colors[0]).toBe(THEME.potionEmerald);
  });

  it("informational weights are zero", () => {
    expect(SCORING_WEIGHTS.deterministic.https_status).toBe(0);
    expect(SCORING_WEIGHTS.deterministic.elevated_attention_tld).toBe(0);
    expect(SCORING_WEIGHTS.deterministic.domain_age_unavailable).toBe(0);
  });

  it("has expected limits and disclaimer", () => {
    expect(INPUT_MAX_CHARS).toBe(10000);
    expect(AI_TIMEOUT_MS).toBe(30000);
    expect(ADVISORY_DISCLAIMER).toBe(
      "Scryvorn provides risk signals and verification guidance, not financial, legal, or law-enforcement advice. Always verify independently."
    );
    expect(JSON.stringify({ SEVERITY_TIERS, ADVISORY_DISCLAIMER })).not.toContain(
      "Verified Safe"
    );
  });
});
