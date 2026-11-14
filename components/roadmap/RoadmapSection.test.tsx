import { afterEach, describe, expect, it } from "vitest";
import { render, type Rendered } from "@/test/dom";
import { ROADMAP_HEADING, RoadmapSection } from "./RoadmapSection";

let mounted: Rendered[] = [];
afterEach(() => {
  mounted.forEach((r) => r.unmount());
  mounted = [];
});

describe("RoadmapSection", () => {
  it("shows the roadmap heading and two distinct roadmap items by title", () => {
    const r = render(<RoadmapSection />);
    mounted.push(r);
    expect(r.container.querySelector("h2")?.textContent).toBe(ROADMAP_HEADING);
    const titles = [...r.container.querySelectorAll("[data-roadmap-item] h3")].map((h) => h.textContent);
    expect(titles).toEqual(["Contract & Lease PDF X-Ray", "Subscription Drain Hunter"]);
  });

  it("is display-only: no inputs, buttons, links, or file controls", () => {
    const r = render(<RoadmapSection />);
    mounted.push(r);
    expect(r.container.querySelector("input, button, a, form, textarea")).toBeNull();
    expect(r.container.textContent).toContain("Not available yet");
  });
});
