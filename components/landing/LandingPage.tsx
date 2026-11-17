import { CandleCluster } from "@/components/halloween/CandleFog";
import { Cobweb } from "@/components/halloween/Cobweb";
import { JackOLantern } from "@/components/halloween/JackOLantern";
import { DECORATIVE_SVG } from "@/components/halloween/seeded";
import { ForensicRadar } from "@/components/inspect/ForensicRadar";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";

/**
 * SCRYVORN landing page (route /). Static: it introduces the tool and links
 * into the inspection app at /inspect. It shows no scan results, scores, or
 * findings. Copy is the approved landing-page copy.
 */
export const INSPECT_HREF = "/inspect";
export const LANDING = {
  heroTitle: "Some messages hide darker intentions.",
  heroSubtitle: "Bring the suspicious into the light.",
  primaryCta: "Examine a message",
  secondaryCta: "See how it works",
  examinesEyebrow: "01 / WHAT WE EXAMINE",
  examinesTitle: "What SCRYVORN examines",
  examines: ["Scam-trigger phrases", "Pressure and payment requests", "Links and domains", "AI interpretation, when available"],
  howEyebrow: "02 / HOW IT WORKS",
  howTitle: "How it works",
  steps: [
    ["Step 01", "Paste the suspicious message."],
    ["Step 02", "SCRYVORN examines its text and links."],
    ["Step 03", "It organizes evidence and context."],
    ["Step 04", "It presents a risk signal and next steps."],
  ],
  layersEyebrow: "03 / FORENSIC LAYERS",
  layersTitle: "Forensic layers",
  layers: ["Message text", "Links and domains", "AI interpretation", "Verdict"],
  aboutEyebrow: "04 / ABOUT & BOUNDARIES",
  aboutTitle: "Important limitation",
  limitation: [
    "SCRYVORN does not decide whether a message is fraudulent.",
    "Its risk score is an uncalibrated heuristic signal, not proof.",
  ],
  ctaPrimary: "Examine a message",
  ctaSecondary: "Learn how it works",
} as const;

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.22em] text-scry-amber";
const H2 = "mt-3 font-serif text-3xl font-medium text-scry-ivory sm:text-4xl";
const CARD = "relative rounded-sm border border-scry-border bg-scry-card/95 p-5 shadow-panel";
const PRIMARY =
  "inline-flex min-h-[52px] items-center justify-center rounded-sm border border-scry-amber/40 bg-scry-crimson px-7 py-3 font-bold tracking-wide text-scry-ivory shadow-amber-glow transition hover:brightness-110";
const SECONDARY =
  "inline-flex min-h-[52px] items-center justify-center rounded-sm border border-scry-amber/50 bg-scry-bg/70 px-7 py-3 font-semibold text-scry-ivory transition hover:border-scry-amber";

/** Small amber line icons for "What SCRYVORN examines" (decorative). */
const ICONS = [
  "M5 7h6v6H7l-2 3zM13 7h6v6h-4l-2 3z",
  "M12 3v18M8 7h6a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h6",
  "M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 5.6l-1.2 1.2M14 10a4 4 0 0 1 0 5.6l-2 2a4 4 0 0 1-5.6-5.6l1.2-1.2",
  "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3",
];
const LAYER_ACCENT = ["border-l-scry-amber", "border-l-scry-amber", "border-l-scry-green", "border-l-scry-crimson"];

export function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-12 pt-10 sm:gap-28 sm:px-6 sm:pt-16">
      {/* Hero */}
      <section aria-labelledby="hero-title" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <p className={EYEBROW}>BEWARE WHAT FINDS YOU.</p>
          <h1 id="hero-title" className="mt-4 font-serif text-5xl font-medium leading-[1.04] text-scry-ivory sm:text-6xl lg:text-7xl">
            {LANDING.heroTitle}
          </h1>
          <p className="mt-5 text-lg text-scry-muted sm:text-xl">{LANDING.heroSubtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={INSPECT_HREF} data-cta="primary" className={PRIMARY}>
              {LANDING.primaryCta}
            </a>
            <a href="#how-it-works" data-cta="secondary" className={SECONDARY}>
              {LANDING.secondaryCta}
            </a>
          </div>
        </div>
        <div className={`${CARD} flex flex-col items-center gap-4 py-8`} aria-hidden="true" data-decorative="hero-reticle">
          <Cobweb size={72} flip opacity={0.22} className="absolute right-0 top-0" />
          <ForensicRadar active={false} label="Awaiting evidence" />
          <div className="flex items-end gap-3">
            <CandleCluster id="hero-cand" scale={0.55} />
            <JackOLantern id="hero-jol" width={78} />
          </div>
        </div>
      </section>

      {/* 01 What SCRYVORN examines */}
      <section aria-labelledby="examines-title">
        <p className={EYEBROW}>{LANDING.examinesEyebrow}</p>
        <h2 id="examines-title" className={H2}>
          {LANDING.examinesTitle}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING.examines.map((item, i) => (
            <li key={item} className={`${CARD} flex items-start gap-3`}>
              <svg {...DECORATIVE_SVG} viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 text-scry-amber">
                <path d={ICONS[i]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-serif text-xl text-scry-ivory">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 02 How it works */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-6">
        <p className={EYEBROW}>{LANDING.howEyebrow}</p>
        <h2 id="how-title" className={H2}>
          {LANDING.howTitle}
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING.steps.map(([step, text]) => (
            <li key={step} className={`${CARD} border-t-2 border-t-scry-amber/60`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-scry-amber">{step}</p>
              <p className="mt-3 font-serif text-xl leading-snug text-scry-ivory">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 03 Forensic layers */}
      <section aria-labelledby="layers-title">
        <p className={EYEBROW}>{LANDING.layersEyebrow}</p>
        <h2 id="layers-title" className={H2}>
          {LANDING.layersTitle}
        </h2>
        <ol className="mt-8 flex flex-col gap-3">
          {LANDING.layers.map((layer, i) => (
            <li
              key={layer}
              className={`${CARD} border-l-4 ${LAYER_ACCENT[i]} flex items-baseline gap-4 py-4`}
              style={{ marginLeft: `${i * 4}%` }}
            >
              <span className="font-serif text-lg tabular-nums text-scry-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif text-2xl text-scry-ivory">{layer}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 04 About & boundaries */}
      <section id="about" aria-labelledby="about-title" className="scroll-mt-6">
        <p className={EYEBROW}>{LANDING.aboutEyebrow}</p>
        <h2 id="about-title" className={H2}>
          {LANDING.aboutTitle}
        </h2>
        <div className={`${CARD} mt-8 border-l-4 border-l-scry-crimson`}>
          {LANDING.limitation.map((line) => (
            <p key={line} className="font-serif text-2xl leading-snug text-scry-ivory first:mt-0 [&+p]:mt-3">
              {line}
            </p>
          ))}
        </div>
        <div className="mt-12">
          <RoadmapSection />
        </div>
      </section>

      {/* Call to action */}
      <section aria-labelledby="cta-title" className={`${CARD} flex flex-col items-start gap-6 p-8 sm:p-10`}>
        <Cobweb size={88} opacity={0.2} className="absolute left-0 top-0" />
        <h2 id="cta-title" className="font-serif text-3xl font-medium text-scry-ivory sm:text-4xl">
          {LANDING.heroSubtitle}
        </h2>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a href={INSPECT_HREF} data-cta="primary" className={PRIMARY}>
            {LANDING.ctaPrimary}
          </a>
          <a href="#how-it-works" data-cta="secondary" className={SECONDARY}>
            {LANDING.ctaSecondary}
          </a>
        </div>
      </section>
    </div>
  );
}
