import type { ScanResult } from "@/lib/types";
import { Cobweb } from "@/components/halloween/Cobweb";
import { AiInterpretation } from "./AiInterpretation";
import { RecommendedSteps } from "./RecommendedSteps";
import { VerifiedChecks } from "./VerifiedChecks";
import { WaxSealVerdict } from "./WaxSealVerdict";

export const PANEL =
  "relative min-w-0 rounded-sm border border-scry-border bg-scry-card/95 p-5 shadow-panel sm:p-7";

/**
 * "Risk revealed" results, from one real ScanResult. Two-column workspace on
 * wide screens (stacks on mobile):
 * - left: Verdict, then Verified Checks (Evidence found, Context observed,
 *   Checks not performed),
 * - right: AI Interpretation, then Recommended steps.
 * DOM order matches reading order: verdict, rule-based evidence, AI, steps.
 */
export function ResultsPanel({ result }: { result: ScanResult }) {
  return (
    <div data-results="" className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className={`${PANEL} flex flex-col gap-8`}>
        <WaxSealVerdict result={result} />
        <VerifiedChecks result={result} />
      </div>
      <div className={`${PANEL} scry-ambient-panel flex flex-col gap-8`}>
        <Cobweb size={72} flip opacity={0.22} className="absolute right-0 top-0" />
        <AiInterpretation result={result} />
        <RecommendedSteps result={result} />
      </div>
    </div>
  );
}
