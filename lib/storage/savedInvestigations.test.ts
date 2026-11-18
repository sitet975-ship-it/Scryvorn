import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADVISORY_DISCLAIMER } from "@/lib/constants";
import { buildPlainTextReport } from "@/lib/report/reportDocument";
import type { CompleteScanResult } from "@/lib/types";
import {
  MAX_SAVED,
  SAVED_INVESTIGATIONS_KEY,
  clearSaved,
  deleteSaved,
  isSavedInvestigation,
  loadSaved,
  saveInvestigation,
} from "./savedInvestigations";

const RESULT: CompleteScanResult = {
  timestamp: "2026-11-14T08:48:12Z",
  inputType: "message",
  deterministicStatus: "complete",
  incompleteChecks: [],
  riskScore: 37,
  severityTier: "Low risk — still verify independently",
  waxSealColor: "#15803D",
  deterministicFindings: [
    { id: "t", source: "deterministic", check: "scam_triggers", category: "urgency_pressure", label: "urgency", evidence: "act now", severity: "medium", weight: 12 },
  ],
  aiFindings: [],
  recommendedSteps: ["Verify independently."],
  aiAvailable: false,
  aiUnavailableReason: "error",
  lookalikeCheckActive: false,
  domainAgeAvailable: false,
  disclaimer: ADVISORY_DISCLAIMER,
};

/** In-memory Storage with an optional byte quota. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  writes = 0;
  constructor(private quota = Infinity, private failAll = false) {}
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    if (this.failAll) throw new Error("blocked");
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.writes++;
    if (this.failAll || v.length > this.quota) throw new DOMException("full", "QuotaExceededError");
    this.map.set(k, v);
  }
}

const at = (iso: string) => new Date(iso);

describe("saveInvestigation / loadSaved", () => {
  it("saves the submitted text, full result, plain-text report, and save time, newest first", () => {
    const s = new MemoryStorage();
    const a = saveInvestigation("first message", RESULT, s, at("2026-11-14T09:00:00Z"));
    const b = saveInvestigation("second https://x.example", { ...RESULT, riskScore: 80, severityTier: "TRAP DETECTED" }, s, at("2026-11-14T09:05:00Z"));
    expect(a.ok && b.ok).toBe(true);
    const list = loadSaved(s);
    expect(list.map((e) => e.input)).toEqual(["second https://x.example", "first message"]);
    expect(list[1].result).toEqual(RESULT);
    expect(list[1].report).toBe(buildPlainTextReport(RESULT));
    expect(list[1].savedAt).toBe("2026-11-14T09:00:00.000Z");
    expect(new Set(list.map((e) => e.id)).size).toBe(2);
    expect(JSON.parse(s.getItem(SAVED_INVESTIGATIONS_KEY)!)).toHaveLength(2);
  });

  it(`keeps at most ${MAX_SAVED} entries, dropping the oldest`, () => {
    const s = new MemoryStorage();
    for (let i = 0; i < MAX_SAVED + 3; i++) saveInvestigation(`m${i}`, RESULT, s, at(`2026-11-14T09:${String(i).padStart(2, "0")}:00Z`));
    const list = loadSaved(s);
    expect(list).toHaveLength(MAX_SAVED);
    expect(list[0].input).toBe(`m${MAX_SAVED + 2}`);
    expect(list.at(-1)!.input).toBe("m3");
  });

  it("drops the oldest entries to fit the browser quota, and fails cleanly if even one does not fit", () => {
    const one = JSON.stringify([{ id: "x", savedAt: "", input: "", result: RESULT, report: buildPlainTextReport(RESULT) }]).length;
    const s = new MemoryStorage(one * 2.5);
    for (let i = 0; i < 5; i++) expect(saveInvestigation(`m${i}`, RESULT, s).ok).toBe(true);
    expect(loadSaved(s).length).toBeLessThanOrEqual(2);
    expect(loadSaved(s)[0].input).toBe("m4");
    expect(saveInvestigation("x".repeat(one * 3), RESULT, s).ok).toBe(false);
  });

  it("returns ok: false and never throws when storage is unavailable or blocked", () => {
    expect(saveInvestigation("m", RESULT, null)).toEqual({ ok: false });
    expect(saveInvestigation("m", RESULT, new MemoryStorage(Infinity, true))).toEqual({ ok: false });
    expect(loadSaved(null)).toEqual([]);
    expect(clearSaved(null)).toBe(false);
  });

  it("does not save a malformed result", () => {
    const s = new MemoryStorage();
    expect(saveInvestigation("m", { ...RESULT, riskScore: 900 } as CompleteScanResult, s).ok).toBe(false);
    expect(s.writes).toBe(0);
  });

  it("skips corrupted or tampered entries and ignores unreadable data", () => {
    const s = new MemoryStorage();
    saveInvestigation("good", RESULT, s);
    const good = JSON.parse(s.getItem(SAVED_INVESTIGATIONS_KEY)!)[0];
    s.setItem(
      SAVED_INVESTIGATIONS_KEY,
      JSON.stringify([
        good,
        { ...good, id: "" },
        { ...good, id: "bad-result", result: { ...RESULT, deterministicStatus: "maybe" } },
        { ...good, id: "bad-finding", result: { ...RESULT, deterministicFindings: [{ ...RESULT.deterministicFindings[0], label: { html: "<img>" } }] } },
        { ...good, id: "bad-date", savedAt: "soon" },
        "nonsense",
        null,
      ]),
    );
    expect(loadSaved(s).map((e) => e.id)).toEqual([good.id]);
    s.setItem(SAVED_INVESTIGATIONS_KEY, "{not json");
    expect(loadSaved(s)).toEqual([]);
    s.setItem(SAVED_INVESTIGATIONS_KEY, JSON.stringify({ not: "an array" }));
    expect(loadSaved(s)).toEqual([]);
    expect(isSavedInvestigation(good)).toBe(true);
  });
});

describe("deleteSaved / clearSaved", () => {
  it("deletes one entry, then clears all", () => {
    const s = new MemoryStorage();
    saveInvestigation("a", RESULT, s);
    saveInvestigation("b", RESULT, s);
    const [b, a] = loadSaved(s);
    expect(deleteSaved(b.id, s).map((e) => e.id)).toEqual([a.id]);
    expect(loadSaved(s).map((e) => e.id)).toEqual([a.id]);
    expect(deleteSaved(a.id, s)).toEqual([]);
    expect(s.getItem(SAVED_INVESTIGATIONS_KEY)).toBeNull(); // removed, not left as "[]"
    saveInvestigation("c", RESULT, s);
    expect(clearSaved(s)).toBe(true);
    expect(loadSaved(s)).toEqual([]);
    expect(s.getItem(SAVED_INVESTIGATIONS_KEY)).toBeNull();
  });
});

describe("scope of persistence", () => {
  it("uses localStorage only (no sessionStorage, IndexedDB, cookies, or network)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/storage/savedInvestigations.ts"), "utf8");
    expect(src).toContain("window.localStorage");
    expect(src).not.toMatch(/sessionStorage|indexedDB|document\.cookie|caches\.open|fetch\(|XMLHttpRequest|sendBeacon/);
  });
});
