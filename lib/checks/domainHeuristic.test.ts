import { describe, expect, it } from "vitest";
import realTlds from "@/data/elevatedAttentionTlds.json";
import { domainHeuristic, isLookalikeCheckActive } from "./domainHeuristic";
import type { ElevatedAttentionTldList, KnownLegitimateDomainList } from "./types";

const tlds = realTlds as ElevatedAttentionTldList;

const SYNTHETIC_TEST_LEGIT_LIST: KnownLegitimateDomainList = {
  version: "TEST-ONLY",
  source: "synthetic test fixture — not a production reference list",
  date: "2026-01-01",
  domains: ["examplebank.test", "paypal.example"],
};

const lookalikes = (url: string, list = SYNTHETIC_TEST_LEGIT_LIST) =>
  domainHeuristic(url, tlds, list).filter((f) => f.category === "lookalike");

describe("elevated-attention TLD", () => {
  it("flags a listed TLD as informational with weight 0", () => {
    const f = domainHeuristic("https://foo.xyz/a", tlds);
    expect(f).toHaveLength(1);
    expect(f[0].category).toBe("elevated_attention_tld");
    expect(f[0].check).toBe("domain_heuristic");
    expect(f[0].severity).toBe("info");
    expect(f[0].weight).toBe(0);
    expect(f[0].reference).toBe(
      `elevatedAttentionTlds.json v${tlds.version} (${tlds.source}, ${tlds.date})`,
    );
    expect(f[0].evidence).toContain(".xyz");
  });

  it("ignores TLD-like text in path or query", () => {
    expect(domainHeuristic("https://example.com/?x=.xyz", tlds)).toEqual([]);
    expect(domainHeuristic("https://example.com/path.top", tlds)).toEqual([]);
  });

  it("is case-insensitive and tolerates list entries without a dot", () => {
    expect(domainHeuristic("https://FOO.XYZ/", tlds)).toHaveLength(1);
    const noDot = { ...tlds, tlds: ["XYZ"] };
    expect(domainHeuristic("https://foo.xyz/", noDot)).toHaveLength(1);
  });
});

describe("lookalike inactive", () => {
  it("produces nothing without a list or with empty domains", () => {
    expect(domainHeuristic("https://examp1ebank.test", tlds)).toEqual([]);
    expect(
      lookalikes("https://examp1ebank.test", { ...SYNTHETIC_TEST_LEGIT_LIST, domains: [] }),
    ).toEqual([]);
  });

  it("reports activity correctly", () => {
    expect(isLookalikeCheckActive()).toBe(false);
    expect(isLookalikeCheckActive({ ...SYNTHETIC_TEST_LEGIT_LIST, domains: [] })).toBe(false);
    expect(isLookalikeCheckActive(SYNTHETIC_TEST_LEGIT_LIST)).toBe(true);
  });
});

describe("lookalike detection", () => {
  it("high confidence for a confusable substitution on the same TLD", () => {
    const [f] = lookalikes("https://examp1ebank.test/login");
    expect(f.weight).toBe(20);
    expect(f.severity).toBe("medium");
    expect(f.label).toBe("Lookalike domain");
    expect(f.needsManualVerification).toBeFalsy();
    expect(f.suspectedLegitDomain).toBe("examplebank.test");
    expect(f.evidence).toContain("'1' for 'l'");
    expect(f.reference).toContain("TEST-ONLY");
  });

  it("high confidence for rn in place of m", () => {
    const [f] = lookalikes("https://exarnplebank.test");
    expect(f.weight).toBe(20);
    const [g] = lookalikes("https://paypa1.example");
    expect(g.weight).toBe(20);
    const list = { ...SYNTHETIC_TEST_LEGIT_LIST, domains: ["homebank.test"] };
    const [h] = lookalikes("https://hornebank.test", list);
    expect(h.weight).toBe(20);
    expect(h.evidence).toContain("'rn' used in place of 'm'");
  });

  it("low confidence for omission, insertion and transposition", () => {
    for (const url of [
      "https://examplebnk.test",
      "https://examplebankk.test",
      "https://exmaplebank.test",
    ]) {
      const [f] = lookalikes(url);
      expect(f.weight).toBe(10);
      expect(f.severity).toBe("low");
      expect(f.needsManualVerification).toBe(true);
      expect(f.label).toContain("Needs manual verification");
    }
  });

  it("low confidence for same name with a different TLD", () => {
    const [f] = lookalikes("https://examplebank.shop");
    expect(f.weight).toBe(10);
  });

  it("low confidence for an embedded label", () => {
    const [f] = lookalikes("https://paypal.example.secure-login.invalid");
    expect(f.weight).toBe(10);
    expect(f.needsManualVerification).toBe(true);
    expect(f.evidence).toContain("embedded");
  });

  it("does not flag the exact domain or a real subdomain", () => {
    expect(lookalikes("https://examplebank.test")).toEqual([]);
    expect(lookalikes("https://login.examplebank.test")).toEqual([]);
  });

  it("does not look at path or query", () => {
    expect(lookalikes("https://other.test/examplebank.test")).toEqual([]);
    expect(lookalikes("https://other.test/?u=examplebank.test")).toEqual([]);
  });

  it("does not apply the distance rule to short labels", () => {
    const list = { ...SYNTHETIC_TEST_LEGIT_LIST, domains: ["abc.test"] };
    expect(lookalikes("https://abd.test", list)).toEqual([]);
    expect(lookalikes("https://abcd.test", list)).toEqual([]);
  });

  it("returns at most one finding, never asserts impersonation, and is deterministic", () => {
    const list = {
      ...SYNTHETIC_TEST_LEGIT_LIST,
      domains: ["examplebank.test", "examplebank.shop", "exampleb4nk.test"],
    };
    const a = domainHeuristic("https://examp1ebank.test", tlds, list);
    const b = domainHeuristic("https://examp1ebank.test", tlds, list);
    const la = a.filter((f) => f.category === "lookalike");
    expect(la).toHaveLength(1);
    expect(la[0].evidence.toLowerCase()).not.toContain("impersonat");
    expect(a).toEqual(b);
  });

  it("returns [] for unparseable URLs without throwing", () => {
    expect(domainHeuristic("not a url", tlds, SYNTHETIC_TEST_LEGIT_LIST)).toEqual([]);
    expect(domainHeuristic("", tlds)).toEqual([]);
  });
});
