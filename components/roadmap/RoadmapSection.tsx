import { useId } from "react";

/**
 * Roadmap teaser. Display only: no contract/lease PDF parsing, bank-statement
 * analysis, or subscription-drain detection exists in Scryvorn.
 */
export const ROADMAP_HEADING = "Coming Soon — Product Roadmap";
export const ROADMAP_ITEMS = [
  {
    id: "contract-xray",
    title: "Contract & Lease PDF X-Ray",
    description: "Planned: highlight clauses in contracts and leases that deserve a closer look.",
  },
  {
    id: "subscription-hunter",
    title: "Subscription Drain Hunter",
    description: "Planned: help spot recurring charges that may be worth reviewing.",
  },
] as const;

export function RoadmapSection() {
  const id = useId();
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} data-section="roadmap" className="flex flex-col gap-4">
      <h2 id={headingId} className="font-serif text-2xl font-medium text-scry-ivory sm:text-3xl">
        {ROADMAP_HEADING}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {ROADMAP_ITEMS.map((item) => (
          <li
            key={item.id}
            data-roadmap-item={item.id}
            className="rounded-sm border border-scry-border border-l-2 border-l-scry-amber/70 bg-scry-card/95 p-5"
          >
            <h3 className="font-serif text-xl font-semibold text-scry-ivory">{item.title}</h3>
            <p className="mt-1 text-sm text-scry-muted">{item.description}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-scry-amber">Not available yet</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
