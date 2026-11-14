import { afterEach, describe, expect, it, vi } from "vitest";
import { SEVERITY_TIERS } from "@/lib/constants";
import { runDeterministicChecks } from "./deterministicEngine";
import type { DeterministicFinding, KnownLegitimateDomainList } from "./types";

const sum = (fs: DeterministicFinding[]) => fs.reduce((s, f) => s + f.weight, 0);
const tierFor = (total: number) => {
  const score = Math.min(100, Math.max(0, Math.round(total)));
  return SEVERITY_TIERS.find((t) => t.min <= score && score <= t.max)!.tier;
};

// CLEARLY SYNTHETIC fixture; not a production reference list.
const TEST_LEGIT: KnownLegitimateDomainList = {
  version: "TEST-ONLY",
  source: "synthetic test fixture — not a production reference list",
  date: "2026-01-01",
  domains: ["examplebank.com"],
};

const cats = (r: { findings: DeterministicFinding[] }) =>
  r.findings.map((f) => f.category);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runDeterministicChecks", () => {
  it("returns no findings for empty or whitespace input", async () => {
    for (const input of ["", "   \n\t "]) {
      const r = await runDeterministicChecks(input);
      expect(r.findings).toEqual([]);
      expect(r.domainAgeAvailable).toBe(false);
      expect(r.lookalikeCheckActive).toBe(false);
      expect(r.status).toBe("complete");
      expect(r.incompleteChecks).toEqual([]);
    }
  });

  it("reports a full run with URLs and triggers as complete", async () => {
    const r = await runDeterministicChecks(
      "Act now! Pay a fee at https://bit.ly/abc or http://promo.xyz/x",
    );
    expect(r.status).toBe("complete");
    expect(r.incompleteChecks).toEqual([]);
    expect(cats(r)).toContain("shortener");
    expect(cats(r)).toContain("urgency_pressure");
  });

  it("does not throw on malformed URLs", async () => {
    const r = await runDeterministicChecks("see http://[bad and https:// and http://");
    expect(Array.isArray(r.findings)).toBe(true);
  });

  it("orders findings: url1, url2, scam triggers, domain-age note", async () => {
    const r = await runDeterministicChecks(
      "Act now! Pay a fee at https://bit.ly/abc or http://plain-site.com/x",
    );
    const urlOf = (f: DeterministicFinding) => f.url;
    const idx = (pred: (f: DeterministicFinding) => boolean) =>
      r.findings.findIndex(pred);
    const https1 = idx((f) => f.category === "https_status" && urlOf(f)!.includes("bit.ly"));
    const short1 = idx((f) => f.category === "shortener");
    const https2 = idx((f) => f.category === "https_status" && urlOf(f)!.includes("plain-site"));
    const trig = idx((f) => f.check === "scam_triggers");
    const note = idx((f) => f.category === "domain_age_unavailable");
    expect(https1).toBe(0);
    expect(short1).toBe(1);
    expect(https2).toBe(2);
    expect(trig).toBeGreaterThan(https2);
    expect(note).toBe(r.findings.length - 1);
    expect(note).toBeGreaterThan(trig);
  });

  it("makes no network calls by default", async () => {
    const original = globalThis.fetch;
    const fetchMock = vi.fn(() => {
      throw new Error("network disabled");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      await runDeterministicChecks(
        "https://bit.ly/a http://promo.xyz/b https://tinyurl.com/c",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("gives HTTPS findings weight 0", async () => {
    const r = await runDeterministicChecks("http://a-site.com https://b-site.com");
    const https = r.findings.filter((f) => f.category === "https_status");
    expect(https).toHaveLength(2);
    expect(https.every((f) => f.weight === 0)).toBe(true);
  });

  it("treats a lone .xyz URL as informational only", async () => {
    const r = await runDeterministicChecks("https://hello.xyz/page");
    expect(cats(r)).toContain("elevated_attention_tld");
    expect(sum(r.findings)).toBe(0);
    expect(tierFor(sum(r.findings))).toBe("Low risk — still verify independently");
  });

  it("does not change the weight sum when a .xyz URL replaces a non-listed TLD", async () => {
    const base = "Act now and pay a fee. https://bit.ly/q ";
    const a = await runDeterministicChecks(base + "https://hello.xyz/p");
    const b = await runDeterministicChecks(base + "https://hello.com/p");
    expect(sum(a.findings)).toBe(sum(b.findings));
  });

  it("reports duplicate URLs once and one finding per trigger category", async () => {
    const r = await runDeterministicChecks(
      "https://dup-site.com https://dup-site.com urgent urgent act now immediately",
    );
    expect(r.findings.filter((f) => f.category === "https_status")).toHaveLength(1);
    expect(r.findings.filter((f) => f.category === "urgency_pressure")).toHaveLength(1);
  });

  describe("domain age", () => {
    it("adds one not_configured note when no lookup is provided", async () => {
      const r = await runDeterministicChecks("https://site-a.com");
      const notes = r.findings.filter((f) => f.category === "domain_age_unavailable");
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toContain("not_configured");
      expect(notes[0].weight).toBe(0);
      expect(r.domainAgeAvailable).toBe(false);
    });

    it("adds no note and no lookup when there are no URLs", async () => {
      const lookup = vi.fn(async () => 10);
      const r = await runDeterministicChecks("no links here", { domainAgeLookup: lookup });
      expect(lookup).not.toHaveBeenCalled();
      expect(cats(r)).not.toContain("domain_age_unavailable");
      expect(r.domainAgeAvailable).toBe(false);
    });

    it("adds one lookup_failed note when the lookup rejects", async () => {
      const r = await runDeterministicChecks("https://site-a.com", {
        domainAgeLookup: async () => {
          throw new Error("down");
        },
      });
      const notes = r.findings.filter((f) => f.category === "domain_age_unavailable");
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toContain("lookup_failed");
      expect(r.domainAgeAvailable).toBe(false);
      // Optional lookup failure keeps the informational fallback only.
      expect(r.status).toBe("complete");
      expect(r.incompleteChecks).toEqual([]);
    });

    it("adds a domain_age finding with weight 10 for a young domain", async () => {
      const r = await runDeterministicChecks("https://site-a.com", {
        domainAgeLookup: async () => 30,
      });
      const f = r.findings.find((x) => x.category === "domain_age");
      expect(f?.weight).toBe(10);
      expect(r.domainAgeAvailable).toBe(true);
      expect(cats(r)).not.toContain("domain_age_unavailable");
    });

    it("handles mixed success and failure, once per unique hostname in order", async () => {
      const calls: string[] = [];
      const r = await runDeterministicChecks(
        "https://one-site.com/a https://two-site.com/b https://one-site.com/c",
        {
          domainAgeLookup: async (d) => {
            calls.push(d);
            return d === "one-site.com" ? 400 : null;
          },
        },
      );
      expect(calls).toEqual(["one-site.com", "two-site.com"]);
      expect(cats(r)).toContain("domain_age");
      expect(cats(r)).toContain("domain_age_unavailable");
      expect(r.domainAgeAvailable).toBe(true);
    });
  });

  describe("lookalike", () => {
    it("is inactive without an injected list", async () => {
      const r = await runDeterministicChecks("https://examp1ebank.com/login");
      expect(cats(r)).not.toContain("lookalike");
      expect(r.lookalikeCheckActive).toBe(false);
      // An absent list is an approved inactive capability, not a failure.
      expect(r.status).toBe("complete");
      expect(r.incompleteChecks).toEqual([]);
    });

    it("produces a lookalike finding with a synthetic fixture list", async () => {
      const r = await runDeterministicChecks("https://examp1ebank.com/login", {
        legitimateDomains: TEST_LEGIT,
      });
      expect(cats(r)).toContain("lookalike");
      expect(r.lookalikeCheckActive).toBe(true);
    });
  });

  it("is deterministic", async () => {
    const input = "Urgent! https://bit.ly/x http://promo.xyz pay a fee";
    const opts = { domainAgeLookup: async () => 20 };
    expect(await runDeterministicChecks(input, opts)).toEqual(
      await runDeterministicChecks(input, opts),
    );
  });
});
