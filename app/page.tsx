import { RoadmapSection } from '@/components/roadmap/RoadmapSection'
import { ScannerCard } from '@/components/scanner/ScannerCard'

/**
 * Single page: scanner and landing page. The AdvisoryDisclaimer is rendered
 * once by the root layout's footer, not here.
 */
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-3 py-8 sm:px-6 sm:py-12">
      <ScannerCard />
      <RoadmapSection />
    </div>
  )
}
