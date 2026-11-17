import type { Metadata } from 'next'
import './globals.css'
import { sans, serif } from './fonts'
import { AppShell } from '@/components/shell/AppShell'

export const metadata: Metadata = {
  title: 'SCRYVORN — Scam Message & Suspicious Link Inspection',
  description:
    'Paste a suspicious message or link. SCRYVORN examines its text and links, organizes evidence and context, and presents a risk signal and next steps.',
}

/**
 * Root layout: fonts (next/font, with system fallbacks), the shared shell
 * (Halloween backdrop, navigation, tarantula lane, footer with the advisory
 * disclaimer), and page content in <main>.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-scry-bg font-sans text-scry-ivory antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
