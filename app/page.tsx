import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Scryvorn — Scam Message & Suspicious Link Scanner',
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="bg-moonlit-midnight text-aged-parchment py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Scryvorn
          </h1>
          <p className="mt-2 text-sm sm:text-base opacity-80">
            Scam Message &amp; Suspicious Link Forensics Scanner
          </p>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-center text-dark-ink">
          Scanner coming soon. Project initialized and ready for implementation.
        </p>
      </section>

      <footer className="bg-moonlit-midnight text-aged-parchment py-6 px-4 mt-auto">
        <div className="max-w-4xl mx-auto text-center text-xs opacity-70">
          Scryvorn provides risk signals and verification guidance, not
          financial, legal, or law-enforcement advice.
        </div>
      </footer>
    </main>
  )
}
