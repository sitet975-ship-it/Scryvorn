import { describe, expect, it } from "vitest";
import { hostnameMatchesDomain, parseHostname } from "./hostname";

describe("parseHostname", () => {
  it("lowercases the hostname", () => {
    expect(parseHostname("https://BIT.LY/Abc")).toBe("bit.ly");
  });
  it("strips a single trailing dot", () => {
    expect(parseHostname("https://bit.ly./x")).toBe("bit.ly");
  });
  it("returns null for unparseable input without throwing", () => {
    expect(parseHostname("not a url")).toBeNull();
    expect(parseHostname("")).toBeNull();
  });
});

describe("hostnameMatchesDomain", () => {
  it("matches exact and subdomain", () => {
    expect(hostnameMatchesDomain("bit.ly", "bit.ly")).toBe(true);
    expect(hostnameMatchesDomain("x.bit.ly", "bit.ly")).toBe(true);
  });
  it("does not match suffix-only or domain-as-prefix hosts", () => {
    expect(hostnameMatchesDomain("notbit.ly", "bit.ly")).toBe(false);
    expect(hostnameMatchesDomain("bit.ly.evil.com", "bit.ly")).toBe(false);
  });
  it("normalizes domain case", () => {
    expect(hostnameMatchesDomain("bit.ly", "BIT.LY")).toBe(true);
  });
});
