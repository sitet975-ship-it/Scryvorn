"use client";

/**
 * One-click sample buttons. Prop-driven: the sample text is supplied by the
 * caller (lib/samples/sampleTraps.ts). Clicking a button calls `onSelect`
 * with that sample's content, and the caller replaces the textarea content.
 *
 * Labels are restricted by type to the three required sample names.
 */
export const SAMPLE_TRAP_LABELS = [
  "Fake Remote Job DM",
  "Phishing Payment Link",
  "Legitimate Bank Alert",
] as const;

export type SampleTrapLabel = (typeof SAMPLE_TRAP_LABELS)[number];

export interface SampleTrap {
  id: string;
  label: SampleTrapLabel;
  content: string;
}

export interface SampleTrapButtonsProps {
  samples: readonly SampleTrap[];
  onSelect: (content: string) => void;
  disabled?: boolean;
}

export function SampleTrapButtons({ samples, onSelect, disabled = false }: SampleTrapButtonsProps) {
  return (
    <div role="group" aria-label="Sample messages" className="flex flex-wrap gap-2">
      {samples.map((sample) => (
        <button
          key={sample.id}
          type="button"
          disabled={disabled}
          data-sample-id={sample.id}
          onClick={() => onSelect(sample.content)}
          className="inline-flex min-h-[44px] items-center rounded-sm border border-scry-border bg-scry-bg/70 px-3 py-2 text-sm font-medium text-scry-ivory transition hover:border-scry-amber/60 hover:text-scry-ivory disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scry-amber"
        >
          {sample.label}
        </button>
      ))}
    </div>
  );
}
