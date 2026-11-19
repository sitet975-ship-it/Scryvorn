import { afterEach, describe, expect, it, vi } from "vitest";
import { extractUrls } from "./urlExtractor";

describe("extractUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns [] for empty or whitespace input", () => {
    expect(extractUrls("")).toEqual([]);
    expect(extractUrls("   \n\t ")).toEqual([]);
  });

  it("extracts a single URL", () => {
    expect(extractUrls("Visit https://example.com now")).toEqual(["https://example.com"]);
  });

  it("extracts multiple URLs including bare www hosts in original form", () => {
    expect(extractUrls("a http://one.test b https://two.test/x c www.three.test")).toEqual([
      "http://one.test",
      "https://two.test/x",
      "www.three.test",
    ]);
  });

  it("strips trailing punctuation", () => {
    expect(
      extractUrls('See https://a.test/p. Also (https://b.test), "https://c.test"! https://d.test?; https://e.test:')
    ).toEqual(["https://a.test/p", "https://b.test", "https://c.test", "https://d.test", "https://e.test"]);
  });

  it("preserves paths and query strings", () => {
    expect(extractUrls("go https://x.test/a/b?q=1&r=2#frag now")).toEqual([
      "https://x.test/a/b?q=1&r=2#frag",
    ]);
  });

  it("skips malformed tokens without throwing", () => {
    expect(() => extractUrls("http:// https://[bad ht!tp://x")).not.toThrow();
    expect(extractUrls("http:// https://[bad ht!tp://x")).toEqual([]);
    expect(extractUrls("bad https://[bad then https://good.test")).toEqual(["https://good.test"]);
  });

  it("deduplicates preserving first-seen order", () => {
    expect(extractUrls("https://b.test https://a.test https://b.test")).toEqual([
      "https://b.test",
      "https://a.test",
    ]);
  });

  it("is deterministic for identical input", () => {
    const input = "x https://a.test/1, www.b.test y https://a.test/1";
    expect(extractUrls(input)).toEqual(extractUrls(input));
  });

  it("extracts bare name.tld links on reviewed TLDs, in text order", () => {
    expect(
      extractUrls("Log in at amaz0n-login.com/verify now, or paypal.com.secure-check.xyz. Also https://x.test"),
    ).toEqual(["amaz0n-login.com/verify", "paypal.com.secure-check.xyz", "https://x.test"]);
  });

  it("does not treat emails, file names, abbreviations, or tech names as links", () => {
    expect(extractUrls("Email support@bank.com, see report.pdf, e.g. Node.js and Next.js, v1.2.3")).toEqual([]);
  });

  it("does not split an explicit URL or www host into a second bare link", () => {
    expect(extractUrls("https://shop.example.com/x and www.paypal.com")).toEqual([
      "https://shop.example.com/x",
      "www.paypal.com",
    ]);
  });

  it("ignores bare names on TLDs that are not on the reviewed list", () => {
    expect(extractUrls("careers-portal.example and pay.test")).toEqual([]);
  });

  it("never calls fetch", () => {
    const fetchStub = vi.fn(() => {
      throw new Error("fetch must not be called");
    });
    vi.stubGlobal("fetch", fetchStub);
    expect(extractUrls("https://a.test www.b.test")).toEqual(["https://a.test", "www.b.test"]);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
