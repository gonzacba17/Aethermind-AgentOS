import { NeuralBackground } from "@/components/neural-background"
import { SiteHeader } from "@/components/site-header"
import { IntroSequence } from "@/components/intro-sequence"
import { ProblemSolution } from "@/components/problem-solution"
import { SocialProof } from "@/components/social-proof"
import { CapacidadesSection } from "@/components/capacidades-section"
import { PricingSection } from "@/components/pricing-section"
import { SiteFooter } from "@/components/site-footer"

export default function AethermindPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <NeuralBackground />
      <div className="relative z-10">
        <SiteHeader />
        <IntroSequence />
        <ProblemSolution />
        <SocialProof />
        <CapacidadesSection />
        <PricingSection />

        <SiteFooter />
      </div>
    </main>
  )
}
