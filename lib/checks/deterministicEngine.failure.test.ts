import { afterEach, describe, expect, it, vi } from "vitest";
import realTlds from "@/data/elevatedAttentionTlds.json";
import { runDeterministicChecks } from "./deterministicEngine";
import { domainHeuristic } from "./domainHeuristic";
import type {
  DeterministicResult,
  ElevatedAttentionTldList,
  KnownLegitimateDomainList,
} from "./types";

/**
 * Forced internal failures, injected with vi.mock. Each mock passes through to
 * the real implementation unless its flag is set, so no production option
 * exists solely to force errors.
 */
const h = vi.hoisted(() => ({
  failTriggers: false,
  /** Throw from domainHeuristic for URLs containing this text. */
  failHeuristicFor: null as string | null,
  failHostnameMatch: false,
  /** Exception text that must never appear in the result. */
  secret: "INTERNAL-DETAIL-7f3a-do-not-expose",
}));

vi.mock("./scamTriggerDetector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scamTriggerDetector")>();
  return {
    ...actual,
    detectScamTriggers: (...args: Parameters<typeof actual.detectScamTriggers>) => {
      if (h.failTriggers) throw new Error(h.secret);
      return actual.detectScamTriggers(...args);
    },
  };
});

vi.mock("./domainHeuristic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./domainHeuristic")>();
  return {
    ...actual,
    domainHeuristic: (...args: Parameters<typeof actual.domainHeuristic>) => {
      if (h.failHeuristicFor !== null && args[0].includes(h.failHeuristicFor)) {
        throw new Error(h.secret);
      }
      return actual.domainHeuristic(...args);
    },
  };
});

vi.mock("./hostname", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./hostname")>();
  return {
    ...actual,
    hostnameMatchesDomain: (...args: Parameters<typeof actual.hostnameMatchesDomain>) => {
      if (h.failHostnameMatch) throw new Error(h.secret);
      return actual.hostnameMatchesDomain(...args);
    },
  };
});

// CLEARLY SYNTHETIC fixture; not a production reference list.
const TEST_LEGIT: KnownLegitimateDomainList = {
  version: "TEST-ONLY",
  source: "synthetic test fixture — not a production reference list",
  date: "2026-01-01",
  domains: ["examplebank.com"],
};

const USER_TEXT = "Act now! my PIN is 4321";
const cats = (r: DeterministicResult) => r.findings.map((f) => f.category);

/** Public metadata must carry neither exception text nor user input. */
function expectNoLeak(r: DeterministicResult) {
  const meta = JSON.stringify({ status: r.status, incompleteChecks: r.incompleteChecks });
  expect(meta).not.toContain(h.secret);
  expect(meta).not.toContain("4321");
  expect(JSON.stringify(r)).not.toContain(h.secret);
}

afterEach(() => {
  h.failTriggers = false;
  h.failHeuristicFor = null;
  h.failHostnameMatch = false;
});

describe("runDeterministicChecks with forced internal failures", () => {
  it("is complete when the mocks pass through", async () => {
    const r = await runDeterministicChecks(`${USER_TEXT} https://bit.ly/x`);
    expect(r.status).toBe("complete");
    expect(r.incompleteChecks).toEqual([]);
  });

  it("marks the run incomplete when scam-trigger detection fails, keeping URL findings", async () => {
    h.failTriggers = true;
    const lookup = vi.fn(async () => 400);
    const r = await runDeterministicChecks(`${USER_TEXT} https://bit.ly/x`, {
      domainAgeLookup: lookup,
    });

    expect(r.status).toBe("incomplete");
    expect(r.incompleteChecks).toEqual(["scam_triggers"]);
    // Findings collected before the failure are preserved.
    expect(cats(r)).toContain("https_status");
    expect(cats(r)).toContain("shortener");
    expect(r.findings.some((f) => f.check === "scam_triggers")).toBe(false);
    // Optional domain-age stage is skipped for an incomplete run.
    expect(lookup).not.toHaveBeenCalled();
    expect(cats(r)).not.toContain("domain_age_unavailable");
    expect(r.domainAgeAvailable).toBe(false);
    expectNoLeak(r);
  });

  it("lists per-URL checks as unfinished when a later URL fails", async () => {
    h.failHeuristicFor = "second-site";
    const r = await runDeterministicChecks(
      `${USER_TEXT} https://first-site.com https://second-site.com`,
    );

    expect(r.status).toBe("incomplete");
    expect(r.incompleteChecks).toEqual([
      "https_status",
      "shortener",
      "domain_heuristic",
      "url_structure",
      "scam_triggers",
    ]);
    const httpsUrls = r.findings
      .filter((f) => f.category === "https_status")
      .map((f) => f.url);
    expect(httpsUrls).toEqual(["https://first-site.com", "https://second-site.com"]);
    expect(cats(r)).not.toContain("urgency_pressure");
    expectNoLeak(r);
  });

  it("keeps lookalike activation separate from completion", async () => {
    h.failHeuristicFor = "examp1ebank";
    const r = await runDeterministicChecks("https://examp1ebank.com/login", {
      legitimateDomains: TEST_LEGIT,
    });

    // The list was injected (active), but the check did not finish.
    expect(r.lookalikeCheckActive).toBe(true);
    expect(r.status).toBe("incomplete");
    expect(r.incompleteChecks).toContain("domain_heuristic");
    expect(cats(r)).not.toContain("lookalike");
    expectNoLeak(r);
  });

  it("propagates a failure deep inside a helper instead of swallowing it", async () => {
    h.failHostnameMatch = true;
    const r = await runDeterministicChecks(`${USER_TEXT} https://bit.ly/x`);

    expect(r.status).toBe("incomplete");
    expect(r.incompleteChecks).toEqual([
      "https_status",
      "shortener",
      "domain_heuristic",
      "url_structure",
      "scam_triggers",
    ]);
    expectNoLeak(r);
  });
});

describe("domainHeuristic with a forced internal failure", () => {
  it("throws rather than returning a normal-looking empty result", () => {
    h.failHostnameMatch = true;
    const tlds = realTlds as ElevatedAttentionTldList;
    expect(() => domainHeuristic("https://examp1ebank.com", tlds, TEST_LEGIT)).toThrow();
  });

  it("still returns [] for an unparseable URL", () => {
    h.failHostnameMatch = true;
    const tlds = realTlds as ElevatedAttentionTldList;
    expect(domainHeuristic("not a url", tlds, TEST_LEGIT)).toEqual([]);
  });
});
