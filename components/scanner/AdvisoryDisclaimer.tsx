import { ADVISORY_DISCLAIMER } from "@/lib/constants";

/** Advisory banner. Text comes only from ADVISORY_DISCLAIMER. */
export function AdvisoryDisclaimer() {
  return (
    <aside
      aria-label="Advisory disclaimer"
      data-section="advisory-disclaimer"
      className="rounded border-l-4 border-candlelight-gold bg-aged-parchment p-3 text-sm text-dark-ink"
    >
      <p>{ADVISORY_DISCLAIMER}</p>
    </aside>
  );
}
