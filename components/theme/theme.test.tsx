import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { contrastRatio } from "@/test/dom";
import { HEADER_MOTIF_OPACITY, HEADER_TAGLINE, HEADER_TITLE, Header } from "./Header";
import { SPIDERWEB_CORNERS, SpiderwebCorners } from "./SpiderwebCorners";

function parse(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("Header", () => {
  const root = parse(renderToStaticMarkup(<Header />));
  const header = root.querySelector("header")!;

  it("renders the title and tagline as visible text", () => {
    expect(HEADER_TITLE).toBe("Scryvorn");
    expect(HEADER_TAGLINE).toBe("Scam Message & Suspicious Link Forensics Scanner");
    expect(header.querySelector("h1")!.textContent).toBe("Scryvorn");
    expect(header.querySelector("p")!.textContent).toBe(HEADER_TAGLINE);
  });

  it("uses the Moonlit Midnight background", () => {
    expect(header.className).toContain("bg-moonlit-midnight");
  });

  it("keeps the moon and bat motif decorative, low-opacity, and behind the text", () => {
    const motif = header.querySelector('svg[data-decorative="moon-bat"]') as SVGElement;
    expect(motif).not.toBeNull();
    expect(motif.getAttribute("aria-hidden")).toBe("true");
    expect(motif.getAttribute("focusable")).toBe("false");
    const style = motif.getAttribute("style")!.replace(/\s/g, "");
    expect(style).toContain("pointer-events:none");
    expect(style).toContain(`opacity:${HEADER_MOTIF_OPACITY}`);
    expect(HEADER_MOTIF_OPACITY).toBeLessThanOrEqual(0.25);
    // The motif comes first in the DOM; the text container is positioned above it.
    expect(header.firstElementChild).toBe(motif);
    expect(header.querySelector("h1")!.closest("div")!.className).toContain("relative");
  });

  it("keeps the heading text readable on the background", () => {
    // Aged parchment on Moonlit Midnight.
    expect(contrastRatio("#F8F3E6", "#0D1117")).toBeGreaterThan(15);
  });
});

describe("SpiderwebCorners", () => {
  const root = parse(renderToStaticMarkup(<SpiderwebCorners />));
  const wrapper = root.querySelector('[data-decorative="spiderweb"]') as HTMLElement;

  it("is hidden from assistive technology and ignores pointer events", () => {
    const noPointer = (el: Element) =>
      expect(el.getAttribute("style")!.replace(/\s/g, "")).toContain("pointer-events:none");
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    noPointer(wrapper);
    const svgs = Array.from(wrapper.querySelectorAll("svg"));
    expect(svgs).toHaveLength(4);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      noPointer(svg);
    }
  });

  it("places one geometric web at each corner", () => {
    const corners = Array.from(wrapper.querySelectorAll("svg")).map((s) => s.getAttribute("data-corner"));
    expect(corners).toEqual([...SPIDERWEB_CORNERS]);
    const cls = (c: string) => wrapper.querySelector(`svg[data-corner="${c}"]`)!.getAttribute("class")!;
    expect(cls("top-left")).toMatch(/\bleft-0\b.*\btop-0\b|\btop-0\b.*\bleft-0\b/);
    expect(cls("top-right")).toMatch(/\bright-0\b/);
    expect(cls("bottom-left")).toMatch(/\bbottom-0\b/);
    expect(cls("bottom-right")).toMatch(/\bbottom-0\b.*\bright-0\b|\bright-0\b.*\bbottom-0\b/);
  });

  it("contains no focusable or interactive elements", () => {
    expect(wrapper.querySelector("a, button, input, textarea, select, [tabindex]")).toBeNull();
  });
});
