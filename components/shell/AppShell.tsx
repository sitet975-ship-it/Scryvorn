import { CandleCluster, Fog } from "@/components/halloween/CandleFog";
import { HalloweenBackdrop, MobileAtmosphere } from "@/components/halloween/HalloweenBackdrop";
import { JackOLantern } from "@/components/halloween/JackOLantern";
import { TarantulaLane, TarantulaPerimeter } from "@/components/halloween/Tarantula";
import { AdvisoryDisclaimer } from "@/components/scanner/AdvisoryDisclaimer";
import { Header } from "@/components/theme/Header";

export const FOOTER_EDITION = "SCRYVORN · THE HALLOWEEN EDITION";

/**
 * Shared shell for the landing page and the inspection app.
 *
 * Layering: the Halloween backdrop is fixed behind everything (z-0). Header,
 * main content, the tarantula lane, and the footer sit above it (z-10/z-20).
 *
 * Creature zone: main plus the tarantula lane. On wide screens main reserves
 * empty left and right gutters (lg:px-20), and the lane reserves an empty
 * bottom margin; the single tarantula walks only through those reserved
 * spaces, so it never overlaps controls, text, findings, or focus outlines.
 * The advisory disclaimer is rendered once, here.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HalloweenBackdrop />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <MobileAtmosphere />
        <div data-creature-zone="" className="relative flex flex-1 flex-col">
          <main className="flex-1 lg:px-20">{children}</main>
          <TarantulaLane>
            <Fog className="h-full" />
            <div className="absolute bottom-1 left-2 flex items-end gap-1 sm:left-6">
              <JackOLantern id="lane-jol-l" width={64} />
              <CandleCluster id="lane-cand-l" scale={0.5} className="hidden sm:flex" />
            </div>
            <div className="absolute bottom-1 right-2 flex items-end gap-1 sm:right-6">
              <CandleCluster id="lane-cand-r" scale={0.5} className="hidden sm:flex" />
              <JackOLantern id="lane-jol-r" width={56} face="fangs" />
            </div>
          </TarantulaLane>
          <TarantulaPerimeter />
        </div>
        <footer className="relative border-t border-scry-border bg-scry-bg/90 px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <AdvisoryDisclaimer />
            <p className="text-xs font-semibold tracking-[0.2em] text-scry-muted">{FOOTER_EDITION}</p>
          </div>
        </footer>
      </div>
    </>
  );
}
