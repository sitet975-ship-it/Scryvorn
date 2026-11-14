import { describe, it, expect } from "vitest";
import { checkHttps } from "@/lib/checks/httpsValidator";

describe("checkHttps", () => {
  it("records HTTPS usage with weight 0", () => {
    const f = checkHttps("https://example.com/a");
    expect(f.evidence).toContain("Uses HTTPS");
    expect(f.weight).toBe(0);
    expect(f.source).toBe("deterministic");
    expect(f.check).toBe("https_status");
    expect(f.category).toBe("https_status");
    expect(f.severity).toBe("info");
    expect(f.url).toBe("https://example.com/a");
  });

  it("records non-HTTPS with weight 0", () => {
    const f = checkHttps("http://example.com");
    expect(f.evidence).toContain("Does not use HTTPS");
    expect(f.weight).toBe(0);
  });

  it("handles uppercase scheme", () => {
    const f = checkHttps("HTTPS://EXAMPLE.COM");
    expect(f.evidence).toContain("Uses HTTPS");
    expect(f.weight).toBe(0);
  });

  it("does not throw on unparseable input", () => {
    const f = checkHttps("not a url");
    expect(f.weight).toBe(0);
    expect(f.evidence).toContain("Could not determine");
  });

  it("never claims safety", () => {
    for (const u of ["https://a.com", "http://a.com", "garbage"]) {
      const e = checkHttps(u).evidence.toLowerCase();
      expect(e).not.toContain("verified safe");
      expect(e).not.toContain("is safe");
    }
  });

  it("is deterministic", () => {
    expect(checkHttps("https://a.com")).toEqual(checkHttps("https://a.com"));
  });
});
