import { ADVISORY_DISCLAIMER } from "@/lib/constants";

/** Advisory banner. Text comes only from ADVISORY_DISCLAIMER. */
export function AdvisoryDisclaimer() {
  return (
    <aside
      aria-label="Advisory disclaimer"
      data-section="advisory-disclaimer"
      className="rounded-sm border border-scry-border border-l-4 border-l-scry-amber bg-scry-card p-3 text-sm leading-relaxed text-scry-ivory"
    >
      <p>{ADVISORY_DISCLAIMER}</p>
    </aside>
  );
}
