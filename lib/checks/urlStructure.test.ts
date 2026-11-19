import { describe, expect, it, vi } from "vitest";
import realSignals from "@/data/urlRiskSignals.json";
import { SCORING_WEIGHTS } from "@/lib/constants";
import { runDeterministicChecks } from "./deterministicEngine";
import type { UrlRiskSignals } from "./types";
import { checkUrlStructure } from "./urlStructure";

const signals = realSignals as UrlRiskSignals;
const W = SCORING_WEIGHTS.deterministic;
const cats = (url: string) => checkUrlStructure(url, signals).map((f) => f.category);
const score = (url: string) => checkUrlStructure(url, signals).reduce((s, f) => s + f.weight, 0);

describe("checkUrlStructure", () => {
  it("returns [] for plain, ordinary links and unparseable input", () => {
    expect(checkUrlStructure("https://careers-portal.example/apply", signals)).toEqual([]);
    expect(checkUrlStructure("https://www.example.com/about", signals)).toEqual([]);
    expect(checkUrlStructure("https://news.bbc.co.uk/sport", signals)).toEqual([]);
    expect(checkUrlStructure("https://example.com.au/shop", signals)).toEqual([]);
    expect(checkUrlStructure("not a url", signals)).toEqual([]);
    expect(checkUrlStructure("", signals)).toEqual([]);
  });

  it("flags a raw IPv4 or IPv6 host", () => {
    const f = checkUrlStructure("http://192.168.10.5/login", signals);
    expect(f[0]).toMatchObject({ check: "url_structure", category: "ip_address_host", weight: W.url_ip_address_host });
    expect(f[0].evidence).toContain('"192.168.10.5"');
    expect(cats("http://[2001:db8::1]/x")).toContain("ip_address_host");
  });

  it("flags text hidden before '@' and names the real host", () => {
    const f = checkUrlStructure("https://www.paypal.com@evil-site.example/pay", signals);
    const at = f.find((x) => x.category === "credentials_in_url")!;
    expect(at.weight).toBe(W.url_credentials_in_url);
    expect(at.evidence).toContain('"www.paypal.com"');
    expect(at.evidence).toContain('"evil-site.example"');
  });

  it("flags punycode hosts", () => {
    expect(cats("https://xn--80ak6aa92e.com/")).toContain("punycode_host");
  });

  it("flags a familiar ending placed before the real domain, and very deep hosts", () => {
    const f = checkUrlStructure("https://paypal.com.account-check.xyz/", signals);
    const d = f.find((x) => x.category === "deceptive_domain_structure")!;
    expect(d.evidence).toContain('"paypal.com"');
    expect(d.evidence).toContain('"account-check.xyz"');
    expect(cats("https://a.b.c.d.e.example.org/")).toContain("deceptive_domain_structure");
  });

  it("flags digits standing in for letters, but not ordinary numbers", () => {
    const f = checkUrlStructure("https://amaz0n-help.com", signals);
    expect(f.find((x) => x.category === "digit_letter_swap")!.evidence).toContain('"amaz0n"');
    expect(cats("https://g00gle.com")).toContain("digit_letter_swap");
    expect(cats("https://win10.com")).not.toContain("digit_letter_swap");
    expect(cats("https://web3.example")).not.toContain("digit_letter_swap");
    expect(cats("https://office365.com")).not.toContain("digit_letter_swap");
  });

  it("weighs sensitive host words by how many distinct words appear", () => {
    const one = checkUrlStructure("https://secure.example-bank.test", signals).find((x) => x.category === "sensitive_host_keywords")!;
    expect(one.weight).toBe(W.url_sensitive_host_keywords);
    const many = checkUrlStructure("https://secure-login-verify.example", signals).find((x) => x.category === "sensitive_host_keywords")!;
    expect(many.weight).toBe(W.url_sensitive_host_keywords_many);
    expect(many.evidence).toContain('"secure", "login", "verify"');
    // The top-level domain itself is never treated as a word.
    expect(cats("https://example.support/")).not.toContain("sensitive_host_keywords");
  });

  it("flags sensitive words in the path or query, as whole words only", () => {
    expect(cats("https://example.com/account/verify?step=password")).toContain("sensitive_path_keywords");
    expect(cats("https://example.com/accounting/verifying")).not.toContain("sensitive_path_keywords");
  });

  it("flags many hyphens and non-default ports", () => {
    expect(cats("https://your-bank-online-help.example/")).toContain("many_hyphens");
    expect(cats("https://example.com:8443/")).toContain("nonstandard_port");
    expect(cats("https://example.com:443/")).not.toContain("nonstandard_port");
  });

  it("accepts links written without a scheme", () => {
    expect(cats("amaz0n-login.com/verify")).toEqual(["digit_letter_swap", "sensitive_host_keywords", "sensitive_path_keywords"]);
  });

  it("cites the rule set on every finding and never calls fetch", () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    const f = checkUrlStructure("http://paypal.com.secure-login-verify.xyz:8080/account/update", signals);
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) {
      expect(x.reference).toBe(`urlRiskSignals.json v${signals.version} (${signals.source}, ${signals.date})`);
      expect(x.evidence).not.toMatch(/\bsafe\b|fraudulent|\bscam\b/i);
    }
    expect(fetchStub).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("is deterministic", () => {
    const u = "https://paypa1.com.verify-account.top/login";
    expect(checkUrlStructure(u, signals)).toEqual(checkUrlStructure(u, signals));
  });

  it("gives an obviously deceptive new link enough weight on its own to reach Caution", () => {
    expect(score("https://paypal.com.secure-login-verify.xyz/account/update")).toBeGreaterThanOrEqual(40);
  });
});

describe("unseen fake links through the full deterministic engine (no AI)", () => {
  const total = async (input: string) =>
    (await runDeterministicChecks(input)).findings.reduce((s, f) => s + f.weight, 0);

  it("scores a typical phishing message with a new link at Caution or above", async () => {
    const t = await total(
      "Your account will be suspended within 24 hours. Verify your account at amaz0n-security-check.com/login",
    );
    expect(t).toBeGreaterThanOrEqual(40);
  });

  it("scores an IP-address payment link with several pressure tactics as TRAP-level", async () => {
    const t = await total(
      "URGENT: your parcel is on hold. Pay the customs fee of $XX.XX at http://203.0.113.7/pay/invoice or your account will be closed.",
    );
    expect(t).toBeGreaterThanOrEqual(70);
  });

  it("keeps a plain reminder with an ordinary link low", async () => {
    const t = await total("Hi! The meeting notes are at https://docs.example.com/notes/team");
    expect(t).toBe(0);
  });
});
