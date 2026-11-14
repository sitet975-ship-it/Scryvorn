import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { domainAgeUnavailableFinding, lookupDomainAge } from "./domainAgeLookup";

const D = "example.test";

describe("lookupDomainAge", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn(() => {
      throw new Error("fetch must not be called");
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns null without a service and never calls fetch", async () => {
    expect(await lookupDomainAge(D)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("young domain gets weight 10", async () => {
    const f = await lookupDomainAge(D, async () => 30);
    expect(f?.weight).toBe(10);
    expect(f?.severity).toBe("low");
    expect(f?.id).toBe(`domain_age:${D}`);
    expect(f?.check).toBe("domain_age");
  });

  it("old domain gets weight 0", async () => {
    const f = await lookupDomainAge(D, async () => 400);
    expect(f?.weight).toBe(0);
    expect(f?.severity).toBe("info");
  });

  it("boundary 89 vs 90", async () => {
    expect((await lookupDomainAge(D, async () => 89))?.weight).toBe(10);
    expect((await lookupDomainAge(D, async () => 90))?.weight).toBe(0);
    expect((await lookupDomainAge(D, async () => 89.9))?.weight).toBe(10);
  });

  it("returns null when service throws or rejects", async () => {
    expect(
      await lookupDomainAge(D, () => {
        throw new Error("boom");
      }),
    ).toBeNull();
    expect(await lookupDomainAge(D, () => Promise.reject(new Error("no")))).toBeNull();
  });

  it("returns null for null, NaN, negative, infinite values", async () => {
    expect(await lookupDomainAge(D, async () => null)).toBeNull();
    expect(await lookupDomainAge(D, async () => NaN)).toBeNull();
    expect(await lookupDomainAge(D, async () => -5)).toBeNull();
    expect(await lookupDomainAge(D, async () => Infinity)).toBeNull();
  });

  it("returns null on timeout", async () => {
    const f = await lookupDomainAge(D, () => new Promise<number | null>(() => {}), {
      timeoutMs: 20,
    });
    expect(f).toBeNull();
  });
});

describe("domainAgeUnavailableFinding", () => {
  it.each(["not_configured", "lookup_failed"] as const)("weight 0 for %s", (r) => {
    const f = domainAgeUnavailableFinding(r);
    expect(f.weight).toBe(0);
    expect(f.severity).toBe("info");
    expect(f.category).toBe("domain_age_unavailable");
    expect(f.id).toContain(r);
  });
});
