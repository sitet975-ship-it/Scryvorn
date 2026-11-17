import type { Metadata } from 'next'
import { ScannerCard } from '@/components/scanner/ScannerCard'

export const metadata: Metadata = {
  title: 'Examine a message — SCRYVORN',
}

/**
 * Inspection app (/inspect): the four-state scanner connected to the real
 * POST /api/scan backend through lib/scan/scanClient.
 */
export default function InspectPage() {
  return <ScannerCard />
}
