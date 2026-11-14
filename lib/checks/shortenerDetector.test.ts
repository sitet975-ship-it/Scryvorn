import { describe, expect, it } from "vitest";
import realList from "@/data/shorteners.json";
import { SCORING_WEIGHTS } from "@/lib/constants";
import { detectShortener } from "./shortenerDetector";
import type { ShortenerList } from "./types";

const list = realList as ShortenerList;

// Clearly synthetic list for metadata-propagation tests.
const syntheticList: ShortenerList = {
  version: "TEST-9.9",
  source: "synthetic-test-source",
  date: "2000-02-03",
  domains: ["short.test"],
};

describe("detectShortener", () => {
  it("flags a known shortener", () => {
    const f = detectShortener("https://bit.ly/abc", list);
    expect(f).not.toBeNull();
    expect(f).toMatchObject({
      source: "deterministic",
      check: "shortener",
      category: "shortener",
      label: "URL shortener",
      url: "https://bit.ly/abc",
      id: "shortener:https://bit.ly/abc",
    });
    expect(f?.weight).toBe(SCORING_WEIGHTS.deterministic.shortener);
  });

  it("flags subdomains and is case-insensitive", () => {
    expect(detectShortener("https://x.bit.ly/a", list)).not.toBeNull();
    expect(detectShortener("HTTPS://BIT.LY/a", list)).not.toBeNull();
  });

  it("does not match path or query substrings", () => {
    expect(detectShortener("https://example.com/?u=bit.ly", list)).toBeNull();
    expect(detectShortener("https://example.com/bit.ly", list)).toBeNull();
  });

  it("does not match look-alike hostnames", () => {
    expect(detectShortener("https://notbit.ly/x", list)).toBeNull();
    expect(detectShortener("https://bit.ly.evil.example/x", list)).toBeNull();
  });

  it("returns null for unparseable URLs without throwing", () => {
    expect(() => detectShortener("not a url", list)).not.toThrow();
    expect(detectShortener("not a url", list)).toBeNull();
  });

  it("cites metadata from the real list", () => {
    const f = detectShortener("https://bit.ly/abc", list);
    expect(f?.reference).toBe(
      `shorteners.json v${list.version} (${list.source}, ${list.date})`,
    );
  });

  it("cites metadata from a synthetic list, not hardcoded values", () => {
    const f = detectShortener("https://short.test/a", syntheticList);
    expect(f?.reference).toBe(
      "shorteners.json vTEST-9.9 (synthetic-test-source, 2000-02-03)",
    );
    expect(detectShortener("https://bit.ly/abc", syntheticList)).toBeNull();
  });
});
