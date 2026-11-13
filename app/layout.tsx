import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scryvorn — Scam Message & Suspicious Link Scanner',
  description:
    'AI-powered scam-message and suspicious-link forensics scanner. Paste a message or URL to get a risk score, itemized evidence, and verification guidance.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-aged-parchment text-dark-ink antialiased">
        {children}
      </body>
    </html>
  )
}
