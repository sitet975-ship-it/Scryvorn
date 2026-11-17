import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { contrastRatio } from "@/test/dom";
import { HEADER_TITLE, Header, NAV_LINKS } from "./Header";

function parse(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("Header (top navigation)", () => {
  const root = parse(renderToStaticMarkup(<Header />));
  const header = root.querySelector("header")!;

  it("shows the ✧ SCRYVORN brand linking home, with the glyph hidden from assistive technology", () => {
    expect(HEADER_TITLE).toBe("SCRYVORN");
    const brand = header.querySelector("a[data-brand]") as HTMLAnchorElement;
    expect(brand.getAttribute("href")).toBe("/");
    expect(brand.textContent).toBe("✧SCRYVORN");
    const glyph = brand.querySelector('[aria-hidden="true"]')!;
    expect(glyph.textContent).toBe("✧");
  });

  it("links How it works and About to the landing-page sections", () => {
    expect(NAV_LINKS).toEqual([
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#about", label: "About" },
    ]);
    const links = [...header.querySelectorAll("ul a")].map((a) => [a.getAttribute("href"), a.textContent]);
    expect(links).toEqual([
      ["/#how-it-works", "How it works"],
      ["/#about", "About"],
    ]);
    expect(header.querySelector("nav")!.getAttribute("aria-label")).toBe("Main");
  });

  it("uses the approved dark background and contains no page heading", () => {
    expect(header.className).toContain("bg-scry-bg");
    expect(header.querySelector("h1")).toBeNull(); // each page owns its single h1
  });

  it("uses large tap targets for every link and keeps link text on one line", () => {
    for (const a of header.querySelectorAll("a")) {
      expect(a.className).toContain("min-h-[44px]");
      expect(a.className).toContain("whitespace-nowrap");
    }
  });

  it("keeps navigation text readable on the background", () => {
    expect(contrastRatio("#EAE2D6", "#070709")).toBeGreaterThan(15);
    expect(contrastRatio("#A79F94", "#070709")).toBeGreaterThanOrEqual(4.5);
  });
});
