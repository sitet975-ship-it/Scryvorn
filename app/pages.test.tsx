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
    // The resting pose (scry-tarantula-rest, see the CSS tests) places it at 20% in the lane.
    expect(cls).toContain("scry-tarantula-rest");
    expect(cls).toContain("left-0 top-0");
    expect(cls).not.toMatch(/-left-|left-\[-/); // never starts off-screen
    expect(doc.querySelectorAll('svg[data-decorative="tarantula"]')).toHaveLength(1);
    expect(doc.querySelectorAll('svg[data-decorative="tarantula-legs"]')).toHaveLength(1);
    expect(html.match(/id="tar-abdomen"/g)).toHaveLength(1); // no duplicated gradient ids
    // The walking zone is a size container so the walk can use container units.
    expect(doc.querySelector('[data-decorative="tarantula-zone"]')!.className).toContain("[container-type:size]");
  });

  it("draws the tarantula as a static filtered body over an animated, filter-free leg layer", () => {
    const anchor = doc.querySelector("[data-tarantula-anchor]")!;
    const legs = anchor.querySelector('svg[data-decorative="tarantula-legs"]')!;
    const body = anchor.querySelector('svg[data-decorative="tarantula"]')!;
    // Legs come first (underneath), carry the gait, and have no filters.
    expect(legs.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(legs.querySelectorAll(".scry-gait-a, .scry-gait-b")).toHaveLength(8);
    expect(legs.querySelector("[filter]")).toBeNull();
    // The body is not animated.
    expect(body.querySelector('[class*="scry-"]')).toBeNull();
    // No CSS blur filters on the moving anchor's children.
    for (const el of anchor.querySelectorAll("[style]")) expect(el.getAttribute("style")).not.toMatch(/filter/);
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
    // The lift is applied by the resting pose and the lane-walk keyframes (see the CSS tests).
    expect(cls).toContain("[--tar-lift:28px]");

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
    for (const name of ["tracery", "bat", "ghost", "candle", "fog"]) {
      expect(strip.querySelector(`[data-decorative="${name}"]`), name).not.toBeNull();
    }
    // Ghosts on both sides; the lantern lives in the bottom lane instead (no repetition).
    expect(strip.querySelectorAll('[data-decorative="ghost"]')).toHaveLength(2);
    expect(strip.querySelector('[data-decorative="jack-o-lantern"]')).toBeNull();
    expect(strip.querySelector('[data-decorative="cobweb"]')).toBeNull();
    expect(strip.querySelector("a, button, input, textarea, select, [tabindex]")).toBeNull();
  });

  it("includes every approved Halloween element", () => {
    for (const name of ["cathedral", "tracery", "gargoyle", "ghosts", "bats", "descending-spider", "jack-o-lantern", "candle", "fog", "tarantula"]) {
      expect(doc.querySelector(`[data-decorative="${name}"]`), name).not.toBeNull();
    }
  });

  it("has no caped vampire figures, and gothic stonework instead of cathedral cobwebs", () => {
    const backdrop = doc.querySelector('[data-decorative="halloween-backdrop"]')!;
    expect(backdrop.innerHTML).not.toMatch(/vampire/i);
    expect(backdrop.innerHTML).not.toContain("#B91C1C"); // the vampires' red eyes and collar
    expect(backdrop.querySelector('[data-decorative="cobweb"]')).toBeNull();
    expect(backdrop.querySelectorAll('[data-decorative="tracery"]')).toHaveLength(2);
    expect(backdrop.querySelectorAll('[data-decorative="gargoyle"]')).toHaveLength(2);
  });

  it("spreads ghosts across both sides of the screen", () => {
    const sides = [...doc.querySelectorAll('[data-decorative="ghosts"] [data-ghost-side]')].map((g) => g.getAttribute("data-ghost-side"));
    expect(sides.filter((s) => s === "left")).toHaveLength(2);
    expect(sides.filter((s) => s === "right")).toHaveLength(2);
  });

  it("flies each bat on its own path, with its own wingbeat", () => {
    const flights = [...doc.querySelectorAll('[data-decorative="bats"] [data-bat-flight]')].map((b) => b.getAttribute("data-bat-flight"));
    expect(flights).toHaveLength(6);
    expect(new Set(flights).size).toBe(6);
    const flaps = [...html.matchAll(/--flap:([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(flaps.length).toBeGreaterThanOrEqual(9);
    expect(new Set(flaps).size).toBeGreaterThan(4); // not in unison
    for (const f of flaps) expect(f).toBeGreaterThanOrEqual(0.9); // slow cycles only
  });

  it("does not repeat lanterns and candles in the same area", () => {
    const lane = doc.querySelector('[data-decorative="tarantula-lane"]')!;
    expect(lane.querySelectorAll('[data-decorative="jack-o-lantern"]')).toHaveLength(1);
    expect(lane.querySelectorAll('[data-decorative="candle"]')).toHaveLength(1);
    // Lane decorations are hidden on wide screens, where the backdrop has its own.
    for (const el of lane.querySelectorAll("div.absolute")) {
      if (el.querySelector('[data-decorative="jack-o-lantern"], [data-decorative="candle"]')) expect(el.className).toContain("lg:hidden");
    }
    const backdrop = doc.querySelector('[data-decorative="halloween-backdrop"]')!;
    expect(backdrop.querySelectorAll(':scope > div [data-decorative="jack-o-lantern"]')).toHaveLength(1);
    expect(backdrop.querySelectorAll('[data-decorative="candles"]')).toHaveLength(1);
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

  const LANE_Y = "calc(100cqh - var(--tar-box) - var(--tar-lift))";
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  it("rests the tarantula in the lane 20% from the left (also the reduced-motion pose), with a fallback", () => {
    const rest = css.indexOf(".scry-tarantula-rest {");
    expect(rest).toBeGreaterThan(-1);
    expect(rest).toBeLessThan(css.indexOf("@media (prefers-reduced-motion: no-preference)")); // applies without motion
    expect(css).toContain(`.scry-tarantula-rest { transform: translate(20cqw, ${LANE_Y}); }`);
    // Browsers without container units: same pose with left/top, and no walk.
    expect(css).toMatch(/@supports not \(width: 1cqw\) \{\s*\.scry-tarantula-rest \{ left: 20%; top: calc\(100% - var\(--tar-box\) - var\(--tar-lift\)\); transform: none; \}/);
    expect(css).toMatch(/@supports not \(width: 1cqw\) \{\s*\.scry-tarantula-walk \{ animation: none; \}/);
  });

  it("the small-screen lane walk starts and ends at the visible resting position, animating only transform", () => {
    const body = keyframes("scry-lane-walk");
    expect(body).toMatch(new RegExp(`0%,\\s*4%\\s*\\{\\s*transform:\\s*translate\\(20cqw, ${esc(LANE_Y)}\\) rotate\\(0deg\\)`));
    expect(body).toMatch(new RegExp(`100%\\s*\\{\\s*transform:\\s*translate\\(20cqw, ${esc(LANE_Y)}\\) rotate\\(360deg\\)`));
    // Turns around at both ends of the lane (walks right, then left), 20 px in from each edge.
    expect(body).toContain(`44% { transform: translate(calc(96cqw - var(--tar-w) - 20px), ${LANE_Y}) rotate(180deg); }`);
    expect(body).toContain(`88% { transform: translate(calc(4cqw + 20px), ${LANE_Y}) rotate(360deg); }`);
    expect(body).not.toMatch(/\b(left|top):/); // compositor-only motion
  });

  it("the wide-screen walk travels the perimeter: left gutter, bottom lane, right gutter, animating only transform", () => {
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.scry-tarantula-walk\s*\{\s*animation:\s*scry-perimeter/);
    const body = keyframes("scry-perimeter");
    expect(body).toContain("translate(-16px, 2cqh)"); // left gutter, top
    expect(body).toContain("translate(calc(100cqw - var(--tar-w) + 16px), 2cqh)"); // right gutter, top
    expect(body).toContain("calc(100cqh - var(--tar-box) - 8px)"); // bottom lane
    // Faces its direction of travel: down, right, up, left.
    for (const deg of ["90deg", "0deg", "-90deg", "180deg"]) expect(body).toContain(`rotate(${deg})`);
    expect(body).not.toMatch(/\b(left|top):/);
  });

  it("animates decorations with transform and opacity only (no layout, filter, or shadow animation)", () => {
    const frames = css.slice(css.indexOf("@keyframes"));
    const props = new Set([...frames.matchAll(/\{\s*([^{}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1])));
    for (const p of props) expect(["transform", "opacity", "stroke-dashoffset"], p).toContain(p);
  });

  it("gives each bat its own flight keyframes, in both directions", () => {
    const ltr = keyframes("scry-bat-wave-ltr");
    const rtl = keyframes("scry-bat-dip-rtl");
    expect(ltr).toMatch(/0%\s*\{\s*transform:\s*translate\(-12vw/);
    expect(rtl).toMatch(/0%\s*\{\s*transform:\s*translate\(112vw/);
    for (let i = 1; i <= 6; i++) expect(css).toMatch(new RegExp(`\\.scry-bat-${i} \\{ animation: scry-bat-[a-z-]+ \\d+s`));
    const names = [...css.matchAll(/\.scry-bat-\d \{ animation: (scry-bat-[a-z-]+)/g)].map((m) => m[1]);
    expect(new Set(names).size).toBe(6);
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
