/**
 * Page, layout, and decoration tests (static markup, jsdom).
 *
 * next/font/google only works inside the Next.js compiler, so app/fonts is
 * mocked here; the real fonts are exercised by `npm run build`.
 * These tests cannot verify layout, overlap, motion, or rendering; those need
 * a browser.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ADVISORY_DISCLAIMER, SEVERITY_TIERS } from "@/lib/constants";

vi.mock("@/app/fonts", () => ({
  serif: { variable: "font-serif-var" },
  sans: { variable: "font-sans-var" },
}));

const { default: RootLayout } = await import("@/app/layout");
const { default: Home } = await import("@/app/page");
const { default: InspectPage } = await import("@/app/inspect/page");
const { LANDING, INSPECT_HREF } = await import("@/components/landing/LandingPage");

const parse = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
};

describe("root layout", () => {
  const html = renderToStaticMarkup(RootLayout({ children: <p>child</p> }));
  const doc = parse(html.replace(/^<html[^>]*>|<\/html>$/g, ""));

  it("renders the navigation header once, children in main, and the disclaimer once in the footer", () => {
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html).toMatch(/<main[^>]*><p>child<\/p><\/main>/);
    expect(html.split(ADVISORY_DISCLAIMER)).toHaveLength(2);
    expect(html).toMatch(/<footer[\s\S]*Advisory disclaimer[\s\S]*<\/footer>/);
  });

  it("applies the font CSS variables with system fallbacks configured in Tailwind", () => {
    expect(html).toMatch(/<html[^>]*class="font-serif-var font-sans-var"/);
  });

  it("reserves an empty bottom lane and walks the tarantula in a clipped zone outside main and the footer", () => {
    const lane = doc.querySelector('[data-decorative="tarantula-lane"]')!;
    expect(lane).not.toBeNull();
    expect(lane.closest("main")).toBeNull();
    expect(lane.closest("footer")).toBeNull();
    expect(lane.className).toContain("overflow-hidden");
    expect(lane.querySelector("a, button, input, textarea, select, [tabindex]")).toBeNull();

    const zone = doc.querySelector('[data-decorative="tarantula-zone"]')!;
    expect(zone.closest("main")).toBeNull();
    expect(zone.closest("footer")).toBeNull();
    expect(zone.className).toContain("overflow-hidden");
    expect(zone.className).toContain("pointer-events-none");
    expect(zone.querySelector('[data-decorative="tarantula"]')).not.toBeNull();
    // The zone covers main + lane; main reserves wide-screen gutters for the walk.
    const creatureZone = zone.closest("[data-creature-zone]")!;
    expect(creatureZone.querySelector("main")!.className).toContain("lg:px-20");
    expect(creatureZone.contains(lane)).toBe(true);
  });

  it("keeps every decorative layer hidden from assistive technology and pointer input", () => {
    const decorative = [...doc.querySelectorAll("[data-decorative]")];
    expect(decorative.length).toBeGreaterThan(10);
    for (const el of decorative) {
      const hidden = el.closest('[aria-hidden="true"]');
      expect(hidden, el.getAttribute("data-decorative") ?? "").not.toBeNull();
      if (el.tagName.toLowerCase() === "svg") expect(el.getAttribute("focusable")).toBe("false");
      expect(el.querySelector("a, button, input, textarea, select, [tabindex]")).toBeNull();
    }
    const backdrop = doc.querySelector('[data-decorative="halloween-backdrop"]')!;
    expect(backdrop.className).toContain("pointer-events-none");
    expect(backdrop.className).toContain("overflow-hidden");
    expect(backdrop.className).toContain("fixed");
  });

  it("rests the tarantula inside the lane ~20% from the left (visible on load), one instance only", () => {
    const anchors = doc.querySelectorAll("[data-tarantula-anchor]");
    expect(anchors).toHaveLength(1);
    const cls = anchors[0].className;
    expect(cls).toContain("left-[20%]");
    expect(cls).not.toMatch(/-left-|left-\[-/); // never starts off-screen
    expect(doc.querySelectorAll('svg[data-decorative="tarantula"]')).toHaveLength(1);
    expect(html.match(/id="tar-abdomen"/g)).toHaveLength(1); // no duplicated gradient ids
  });

  it("sizes the tarantula box so even its mid-turn pose stays inside the lane", () => {
    const anchor = doc.querySelector("[data-tarantula-anchor]")!;
    const cls = anchor.className;
    const svg = anchor.querySelector('svg[data-decorative="tarantula"]')!;
    expect(svg.getAttribute("class")).toContain("aspect-[240/214]");
    expect(svg.getAttribute("viewBox")).toBe("0 -32 240 214");
    const lane = doc.querySelector('[data-decorative="tarantula-lane"]')!;
    const laneCls = ` ${lane.className} `;
    expect(laneCls).toContain(" h-40 "); // 160 px on mobile
    expect(laneCls).toContain(" sm:h-44 "); // 176 px from sm
    expect(laneCls).toContain(" lg:h-40 ");
    expect(cls).toContain("top-[calc(100%-var(--tar-box)-var(--tar-lift))]");

    const px = (re: RegExp) => Number(cls.match(re)![1]);
    // Lane walk (below lg): at any rotation the box's bounding box is at most
    // (w + h) * sin(45deg) tall, centered lift + h/2 above the lane floor.
    const boxes = [
      { w: px(/(?:^|\s)\[--tar-w:(\d+)px\]/), h: px(/(?:^|\s)\[--tar-box:(\d+)px\]/), lift: px(/(?:^|\s)\[--tar-lift:(\d+)px\]/), lane: 160, minVw: 320 },
      { w: px(/sm:\[--tar-w:(\d+)px\]/), h: px(/sm:\[--tar-box:(\d+)px\]/), lift: px(/sm:\[--tar-lift:(\d+)px\]/), lane: 176, minVw: 640 },
    ];
    for (const b of boxes) {
      const center = b.lift + b.h / 2;
      const half = Math.max(b.w / 2, b.h / 2, ((b.w + b.h) * Math.SQRT1_2) / 2);
      expect(center - half).toBeGreaterThanOrEqual(0); // never below the lane floor
      expect(center + half).toBeLessThanOrEqual(b.lane); // never above the lane top
      // Sideways growth when rotated is covered by the 20 px turn inset (see the lane-walk keyframes).
      // Inset at the turn = 4% of the viewport + 20 px; smallest viewports: 320 px (mobile), 640 px (sm).
      expect(((b.w + b.h) * Math.SQRT1_2 - b.w) / 2).toBeLessThanOrEqual(20 + 0.04 * b.minVw);
    }
    expect(boxes[0]).toMatchObject({ w: 116, h: 103 });
  });

  it("adds a mobile-only Halloween strip as its own block, outside main", () => {
    const strip = doc.querySelector('[data-decorative="mobile-atmosphere"]')!;
    expect(strip).not.toBeNull();
    expect(strip.className).toContain("sm:hidden");
    expect(strip.className).toContain("overflow-hidden");
    expect(strip.closest("main")).toBeNull();
    for (const name of ["jack-o-lantern", "bat", "ghost", "cobweb", "candle", "fog"]) {
      expect(strip.querySelector(`[data-decorative="${name}"]`), name).not.toBeNull();
    }
    expect(strip.querySelector("a, button, input, textarea, select, [tabindex]")).toBeNull();
  });

  it("includes every approved Halloween element", () => {
    for (const name of ["cathedral", "ghosts", "bats", "cobweb", "descending-spider", "jack-o-lantern", "candle", "fog", "tarantula"]) {
      expect(doc.querySelector(`[data-decorative="${name}"]`), name).not.toBeNull();
    }
    // The vampire silhouette lives inside the cathedral artwork.
    expect(doc.querySelector('[data-decorative="cathedral"]')!.innerHTML).toContain("#B91C1C");
  });
});

describe("landing page (/)", () => {
  const html = renderToStaticMarkup(<Home />);
  const doc = parse(html);
  const text = doc.textContent ?? "";

  it("uses the approved copy and a single h1", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")!.textContent).toBe("Some messages hide darker intentions.");
    for (const s of [
      LANDING.heroSubtitle,
      ...LANDING.examines,
      ...LANDING.steps.flat(),
      ...LANDING.layers,
      ...LANDING.limitation,
      "01 / WHAT WE EXAMINE",
      "02 / HOW IT WORKS",
      "03 / FORENSIC LAYERS",
      "04 / ABOUT & BOUNDARIES",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("links every 'Examine a message' call to action to /inspect", () => {
    expect(INSPECT_HREF).toBe("/inspect");
    const examine = [...doc.querySelectorAll("a")].filter((a) => a.textContent === "Examine a message");
    expect(examine).toHaveLength(2);
    for (const a of examine) expect(a.getAttribute("href")).toBe("/inspect");
    const how = [...doc.querySelectorAll("a")].filter((a) => /See how it works|Learn how it works/.test(a.textContent ?? ""));
    expect(how.map((a) => a.getAttribute("href"))).toEqual(["#how-it-works", "#how-it-works"]);
  });

  it("has the How it works and About anchors used by the navigation", () => {
    expect(doc.querySelector("#how-it-works")).not.toBeNull();
    expect(doc.querySelector("#about")).not.toBeNull();
    expect(doc.querySelector("#about")!.textContent).toContain("Important limitation");
  });

  it("keeps the Coming Soon roadmap (Req 10) and shows no scan results, scores, or demo labels", () => {
    expect(doc.querySelector('[data-section="roadmap"]')).not.toBeNull();
    expect(doc.querySelector("[data-score], [data-tier], [data-verdict], [data-finding]")).toBeNull();
    for (const t of SEVERITY_TIERS) expect(text).not.toContain(t.tier);
    expect(text).not.toMatch(/Demo results|Prototype|High risk\. Do not engage/i);
    expect(html).not.toContain(ADVISORY_DISCLAIMER); // rendered once, by the layout
  });
});

describe("inspection page (/inspect)", () => {
  it("renders the scanner in the awaiting view with no fixed verdict text", () => {
    const html = renderToStaticMarkup(<InspectPage />);
    const doc = parse(html);
    expect(html).toContain('data-scan-state="idle"');
    expect(html).toContain('data-view="awaiting"');
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.textContent).toContain("What found its way to you?");
    expect(doc.textContent).toContain("Not every threat announces itself.");
    expect(doc.textContent).not.toMatch(/High risk\. Do not engage|Demo results|Prototype/);
    expect(html).not.toContain(ADVISORY_DISCLAIMER);
  });
});

describe("motion safety (CSS source)", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  it("declares decorative animations only inside prefers-reduced-motion: no-preference", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(start).toBeGreaterThan(-1);
    // Every `animation:` declaration appears after the media query opens and
    // before the keyframes section, which only defines frames.
    const firstKeyframes = css.indexOf("@keyframes");
    const animationDecls = [...css.matchAll(/animation:/g)].map((m) => m.index ?? 0);
    expect(animationDecls.length).toBeGreaterThan(5);
    for (const i of animationDecls) {
      expect(i).toBeGreaterThan(start);
      expect(i).toBeLessThan(firstKeyframes);
    }
  });

  /** Body of one @keyframes block (to the next @keyframes or EOF); LF or CRLF. */
  const keyframes = (name: string) => {
    const start = css.indexOf(`@keyframes ${name}`);
    expect(start, name).toBeGreaterThan(-1);
    const next = css.indexOf("@keyframes", start + 1);
    return css.slice(start, next === -1 ? undefined : next);
  };

  it("the small-screen lane walk starts and ends at the visible resting position", () => {
    const body = keyframes("scry-lane-walk");
    expect(body).toMatch(/0%,\s*4%\s*\{\s*left:\s*20%/);
    expect(body).toMatch(/100%\s*\{\s*left:\s*20%/);
    // Turns around at both ends of the lane (walks right, then left), 20 px in from each edge.
    expect(body).toMatch(/rotate\(180deg\)/);
    expect(body).toMatch(/44%\s*\{\s*left:\s*calc\(96% - var\(--tar-w\) - 20px\);\s*transform:\s*rotate\(180deg\)/);
    expect(body).toMatch(/88%\s*\{\s*left:\s*calc\(4% \+ 20px\);\s*transform:\s*rotate\(360deg\)/);
  });

  it("the wide-screen walk travels the perimeter: left gutter, bottom lane, right gutter", () => {
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.scry-tarantula-walk\s*\{\s*animation:\s*scry-perimeter/);
    const body = keyframes("scry-perimeter");
    expect(body).toMatch(/left:\s*-16px;\s*top:\s*2%/); // left gutter, top
    expect(body).toMatch(/left:\s*calc\(100% - var\(--tar-w\) \+ 16px\);\s*top:\s*2%/); // right gutter, top
    expect(body).toMatch(/top:\s*calc\(100% - var\(--tar-box\) - 8px\)/); // bottom lane
    // Faces its direction of travel: down, right, up, left.
    for (const deg of ["90deg", "0deg", "-90deg", "180deg"]) expect(body).toContain(`rotate(${deg})`);
  });

  it("the ambient radar and panel glow is static by default and only pulses with motion allowed", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    const ringStatic = css.indexOf(".scry-ambient-ring {");
    expect(ringStatic).toBeGreaterThan(-1);
    expect(ringStatic).toBeLessThan(start); // still glow for reduced-motion users
    expect(css.slice(start)).toMatch(/\.scry-ambient-ring\s*\{\s*animation:\s*scry-ambient-ring 7s/);
  });

  it("uses slow cycles: no decorative animation repeats faster than 0.9 s", () => {
    const durations = [...css.matchAll(/animation:\s*[\w-]+\s+([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(durations.length).toBeGreaterThan(5);
    for (const d of durations) expect(d).toBeGreaterThanOrEqual(0.9);
  });
});
