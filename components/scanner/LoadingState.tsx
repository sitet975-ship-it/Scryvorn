/**
 * Loading indicator for the single scan request.
 *
 * The status region is always rendered (role="status", aria-live="polite") so
 * screen readers announce the text when a request starts. It shows one
 * message only; there is no per-check progress because the scan is one
 * request/response. The spinner animates only when the user has not asked
 * for reduced motion (Tailwind `motion-safe:`).
 */
export const LOADING_TEXT = "Inspecting message and links…";

export function LoadingState({ active }: { active: boolean }) {
  return (
    <div role="status" aria-live="polite" className="min-h-6">
      {active ? (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <span
            aria-hidden="true"
            data-spinner=""
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
          />
          {LOADING_TEXT}
        </span>
      ) : null}
    </div>
  );
}
