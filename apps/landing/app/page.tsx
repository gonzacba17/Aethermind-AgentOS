import { NeuralBackground } from "@/components/neural-background"
import { SiteHeader } from "@/components/site-header"
import { IntroSequence } from "@/components/intro-sequence"
import { ProblemSection } from "@/components/problem-section"
import { HowItWorks } from "@/components/how-it-works"
import { CapabilitiesSection } from "@/components/capabilities-section"
import { PricingSection } from "@/components/pricing-section"
import { QuickstartSection } from "@/components/quickstart-section"
import { SiteFooter } from "@/components/site-footer"

export default function AethermindPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <NeuralBackground />
      <div className="relative z-10">
        <SiteHeader />
        <IntroSequence />
        <ProblemSection />
        <HowItWorks />
        <CapabilitiesSection />
        <PricingSection />
        <QuickstartSection />
        <SiteFooter />
      </div>
    </main>
  )
}
