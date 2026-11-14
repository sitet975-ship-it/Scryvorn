"use client";

/**
 * One-click sample buttons. Prop-driven: the sample text is supplied by the
 * caller (production samples are added in Task 9.1). Clicking a button calls
 * `onSelect` with that sample's content, and the caller replaces the
 * textarea content with it.
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
          className="rounded border border-dark-ink/50 bg-aged-parchment px-3 py-1.5 text-sm font-semibold text-dark-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pumpkin-orange"
        >
          {sample.label}
        </button>
      ))}
    </div>
  );
}
