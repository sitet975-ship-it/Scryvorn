/**
 * Top navigation: "✧ SCRYVORN" (links home) on the left; "How it works" and
 * "About" (landing-page sections) on the right. The ✧ glyph is decorative and
 * hidden from assistive technology, so the link is announced as "SCRYVORN".
 * Plain anchors are used so navigation is a full page load: no scan state is
 * carried between pages.
 *
 * Mobile: tighter brand tracking and smaller link padding keep everything on
 * one line at 360 px (links never wrap), while every link keeps a 44 px tap
 * target height.
 */
export const HEADER_TITLE = "SCRYVORN";
export const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#about", label: "About" },
] as const;

const LINK =
  "inline-flex min-h-[44px] items-center whitespace-nowrap rounded-sm px-1.5 text-[0.8125rem] font-medium text-scry-muted transition-colors hover:text-scry-ivory sm:px-2 sm:text-sm";

export function Header() {
  return (
    <header className="relative z-20 border-b border-scry-border bg-scry-bg/85 backdrop-blur-sm">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6">
        <a
          href="/"
          data-brand=""
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm font-serif text-base font-semibold tracking-[0.14em] text-scry-ivory sm:gap-2 sm:text-xl sm:tracking-[0.22em]"
        >
          <span aria-hidden="true" className="text-scry-amber">
            ✧
          </span>
          {HEADER_TITLE}
        </a>
        <ul className="flex shrink-0 items-center gap-0.5 sm:gap-4">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className={LINK}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
