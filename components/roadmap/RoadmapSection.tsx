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
    <section aria-labelledby={headingId} data-section="roadmap" className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xl font-bold">
        {ROADMAP_HEADING}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ROADMAP_ITEMS.map((item) => (
          <li key={item.id} data-roadmap-item={item.id} className="rounded border border-pumpkin-orange/60 p-4">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm">{item.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide">Not available yet</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
