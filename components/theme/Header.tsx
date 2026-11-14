/**
 * Site header on Moonlit Midnight (#0D1117).
 *
 * The crescent moon and bat motif is purely decorative: it is aria-hidden,
 * not focusable, has no pointer events, and sits behind the text at low
 * opacity so the title and tagline stay distinguishable.
 */
export const HEADER_TITLE = "Scryvorn";
export const HEADER_TAGLINE = "Scam Message & Suspicious Link Forensics Scanner";

/** Opacity of the decorative motif (kept low so text stays legible). */
export const HEADER_MOTIF_OPACITY = 0.18;

export function Header() {
  return (
    <header className="relative overflow-hidden bg-moonlit-midnight text-aged-parchment">
      <svg
        aria-hidden="true"
        focusable="false"
        data-decorative="moon-bat"
        className="absolute inset-0 h-full w-full"
        style={{ opacity: HEADER_MOTIF_OPACITY, pointerEvents: "none" }}
        viewBox="0 0 400 120"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Crescent moon */}
        <path d="M318 18a34 34 0 1 0 28 54 27 27 0 1 1-28-54z" fill="currentColor" />
        {/* Bat silhouette */}
        <path
          d="M70 62c6-10 14-14 22-12 2-6 6-9 9-9l2 5 2-5c3 0 7 3 9 9 8-2 16 2 22 12-7-4-13-4-17 0-3-3-8-3-11 1-2-3-3-5-5-5s-3 2-5 5c-3-4-8-4-11-1-4-4-10-4-17 0z"
          fill="currentColor"
        />
      </svg>
      <div className="relative mx-auto max-w-4xl px-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{HEADER_TITLE}</h1>
        <p className="mt-2 text-sm sm:text-base">{HEADER_TAGLINE}</p>
      </div>
    </header>
  );
}
