// @vitest-environment node
/**
 * Task 11.3 smoke and compliance tests.
 *
 * These are static checks of repository files. The secret scan is a
 * heuristic pattern scan: passing it does not prove that no secrets exist.
 * The production build is verified separately with `npm run build`, not here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

/** Tracked files plus untracked files that are not ignored. */
function repoFiles(): string[] {
  return git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) => existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).isFile());
}

function isIgnored(path: string): boolean {
  try {
    git(["check-ignore", "-q", "--no-index", path]);
    return true; // exit 0: ignored
  } catch {
    return false; // exit 1: not ignored
  }
}

describe("data files", () => {
  const files: Record<string, string> = {
    "data/shorteners.json": "domains",
    "data/elevatedAttentionTlds.json": "tlds",
    "data/scamTriggers.json": "categories",
    "data/urlRiskSignals.json": "hostKeywords",
  };

  it.each(Object.entries(files))("%s has version, source, date, and a non-empty %s list", (file, listKey) => {
    const data = JSON.parse(read(file)) as Record<string, unknown>;
    for (const key of ["version", "source", "date"]) {
      expect(typeof data[key], `${file} ${key}`).toBe("string");
      expect((data[key] as string).trim()).not.toBe("");
    }
    expect(data.date as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const list = data[listKey] as unknown[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("every scam-trigger category has an id, a label, and non-empty phrases", () => {
    const data = JSON.parse(read("data/scamTriggers.json")) as {
      categories: { id: string; label: string; phrases: string[] }[];
    };
    for (const c of data.categories) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.phrases.length).toBeGreaterThan(0);
      expect(c.phrases.every((p) => typeof p === "string" && p.trim() !== "")).toBe(true);
    }
  });
});

describe(".env.example", () => {
  const text = read(".env.example");
  const lines = text.split(/\r?\n/);
  const vars = Object.fromEntries(
    lines
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const PLACEHOLDER = /placeholder|^https:\/\/api\.example\.(com|test|org)(\/|$)/i;

  it("lists the AI and domain-age variables with clearly placeholder values", () => {
    for (const name of ["AI_API_KEY", "AI_API_BASE_URL", "AI_MODEL", "DOMAIN_AGE_API_URL", "DOMAIN_AGE_API_KEY"]) {
      expect(vars, name).toHaveProperty(name);
      expect(vars[name], name).toMatch(PLACEHOLDER);
    }
  });

  it("marks the domain-age variables as optional and currently disabled, not required", () => {
    const marker = lines.indexOf("# Optional / currently disabled in code");
    expect(marker).toBeGreaterThan(-1);
    const urlLine = lines.findIndex((l) => l.startsWith("DOMAIN_AGE_API_URL="));
    const keyLine = lines.findIndex((l) => l.startsWith("DOMAIN_AGE_API_KEY="));
    expect(marker).toBeLessThan(urlLine);
    expect(marker).toBeLessThan(keyLine);
    // No other variables between the marker and the domain-age variables.
    expect(lines.slice(marker + 1, Math.max(urlLine, keyLine)).filter((l) => /^[A-Z0-9_]+=/.test(l) && !l.startsWith("DOMAIN_AGE_"))).toEqual([]);
    expect(text).not.toMatch(/DOMAIN_AGE[^\n]*required/i);
  });
});

describe(".gitignore and tracked .kiro", () => {
  it("ignores .env.local (and other .env files) but not .env.example", () => {
    expect(isIgnored(".env.local")).toBe(true);
    expect(isIgnored(".env")).toBe(true);
    expect(isIgnored(".env.example")).toBe(false);
  });

  it("does not ignore .kiro/ specs, steering, or hooks paths, and specs and steering are tracked", () => {
    expect(read(".gitignore")).not.toMatch(/^\s*\/?\.kiro\b/m);
    for (const p of [".kiro/specs/scryvorn/tasks.md", ".kiro/steering/product.md", ".kiro/hooks/x.kiro.hook"]) {
      expect(isIgnored(p), p).toBe(false);
    }
    const tracked = git(["ls-files", ".kiro"]).split(/\r?\n/).filter(Boolean);
    expect(tracked.some((f) => f.startsWith(".kiro/specs/"))).toBe(true);
    expect(tracked.some((f) => f.startsWith(".kiro/steering/"))).toBe(true);
  });
});

describe("LICENSE", () => {
  it("contains the MIT license text", () => {
    const text = read("LICENSE");
    expect(text).toMatch(/^MIT License/);
    expect(text).toContain("Permission is hereby granted, free of charge");
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
  });
});

describe("out-of-scope features", () => {
  const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

  /**
   * Evidence Report PDF export (writing a PDF, not scanning one) is in scope
   * (.kiro/steering/product.md and tech.md). These are the only allowed
   * "pdf" code files.
   */
  const REPORT_PDF_EXPORT = ["lib/report/pdf.ts", "lib/report/pdf.test.ts"];

  it("has no contract-PDF, bank-statement, or subscription-drain modules", () => {
    const offenders = repoFiles()
      .filter((f) => CODE.test(f))
      .filter((f) => !REPORT_PDF_EXPORT.includes(f))
      .filter((f) => /contract|lease|pdf|bank[-_]?statement|statement[-_]?pars|subscription|drain/i.test(f));
    expect(offenders).toEqual([]);
  });

  it("the PDF module only writes the Evidence Report (it never parses or reads PDFs)", () => {
    const src = read("lib/report/pdf.ts");
    expect(src).toContain("export function buildReportPdf");
    expect(src).not.toMatch(/FileReader|arrayBuffer\(|\.text\(\)|fetch\(|getDocument|parsePdf/);
  });

  it("depends on no PDF or statement-parsing packages", () => {
    const pkg = JSON.parse(read("package.json")) as Record<string, Record<string, string> | undefined>;
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /pdf|ofx|statement|plaid|csv-parse/i.test(d))).toEqual([]);
  });
});

describe("runtime and deployment config", () => {
  it("app/api/scan/route.ts uses the Node.js runtime, not the Edge Runtime", () => {
    const src = read("app/api/scan/route.ts");
    expect(src).not.toMatch(/export\s+const\s+runtime\s*=\s*["']edge["']/);
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*["']nodejs["']/);
  });

  it("no route or page exports runtime = \"edge\"", () => {
    const offenders = repoFiles()
      .filter((f) => f.startsWith("app/") && /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /export\s+const\s+runtime\s*=\s*["']edge["']/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("netlify.toml, if present, declares no secret values", () => {
    if (!existsSync(join(ROOT, "netlify.toml"))) {
      expect(existsSync(join(ROOT, "netlify.toml"))).toBe(false); // currently absent
      return;
    }
    const toml = read("netlify.toml");
    expect(toml).not.toMatch(/^\s*(AI_API_KEY|DOMAIN_AGE_API_KEY|[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=/m);
  });
});

describe("heuristic secret-pattern scan (does not prove absence of secrets)", () => {
  /**
   * Synthetic fixtures that intentionally look secret-like. Each must stay
   * obviously fake. Any other match fails the test.
   */
  const ALLOWLIST = [
    "sk-test-NOT-A-REAL-KEY-route",
    "sk-test-NOT-A-REAL-KEY-7f3a",
    "INTERNAL-DETAIL-9c1e-do-not-expose",
    "INTERNAL-DETAIL-7f3a-do-not-expose",
  ];

  const PATTERNS: [string, RegExp][] = [
    ["OpenAI-style key", /sk-[A-Za-z0-9_-]{16,}/g],
    ["AWS access key id", /AKIA[0-9A-Z]{16}/g],
    ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/g],
    ["Slack token", /xox[abprs]-[A-Za-z0-9-]{10,}/g],
    ["Google API key", /AIza[0-9A-Za-z_-]{30,}/g],
    ["Private key block", new RegExp("-----BEGIN [A-Z ]*PRIVATE " + "KEY-----", "g")],
    ["Bearer token", /Bearer\s+[A-Za-z0-9._-]{20,}/g],
    ["Assigned secret", /(api[_-]?key|secret|token|password)["']?\s*[:=]\s*["'][^"'\s]{12,}["']/gi],
  ];

  const SKIP = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf)$/i;

  it("finds no unallowlisted matches in tracked and untracked (non-ignored) files", () => {
    const hits: string[] = [];
    for (const file of repoFiles()) {
      if (SKIP.test(file)) continue;
      const text = read(file);
      for (const [name, re] of PATTERNS) {
        for (const m of text.matchAll(re)) {
          if (ALLOWLIST.some((a) => m[0].includes(a))) continue;
          hits.push(`${file}: ${name}: ${m[0].slice(0, 40)}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("each allowlisted fixture is still present (keeps the allowlist minimal)", () => {
    const all = repoFiles().filter((f) => /\.test\.tsx?$/.test(f)).map(read).join("\n");
    for (const a of ALLOWLIST) expect(all, a).toContain(a);
  });

  it("no .env file other than .env.example is tracked", () => {
    const envFiles = git(["ls-files"]).split(/\r?\n/).filter((f) => /(^|\/)\.env(\.|$)/.test(f));
    expect(envFiles).toEqual([".env.example"]);
  });
});
