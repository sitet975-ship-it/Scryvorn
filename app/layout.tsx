import type { Metadata } from 'next'
import './globals.css'
import { AdvisoryDisclaimer } from '@/components/scanner/AdvisoryDisclaimer'
import { Header } from '@/components/theme/Header'

export const metadata: Metadata = {
  title: 'Scryvorn — Scam Message & Suspicious Link Scanner',
  description:
    'AI-powered scam-message and suspicious-link forensics scanner. Paste a message or URL to get a risk score, itemized evidence, and verification guidance.',
}

/**
 * Root layout: Header once at the top, page content in <main>, and the
 * AdvisoryDisclaimer once in the footer (pages must not render it again).
 * System font stack via Tailwind defaults; no web fonts are loaded.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-moonlit-midnight text-aged-parchment antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="px-4 py-6">
          <div className="mx-auto max-w-3xl">
            <AdvisoryDisclaimer />
          </div>
        </footer>
      </body>
    </html>
  )
}
