'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { NeuralBackground } from "@/components/neural-background"
import { SiteHeader } from "@/components/site-header"
import { IntroSequence } from "@/components/intro-sequence"
import { ProblemSolution } from "@/components/problem-solution"
import { SocialProof } from "@/components/social-proof"
import { CapacidadesSection } from "@/components/capacidades-section"
import { PricingSection } from "@/components/pricing-section"
import { SiteFooter } from "@/components/site-footer"
import { saveToken, redirectAfterAuth } from "@/lib/auth-utils"

function OAuthHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // WORKAROUND: Backend redirects to /?token=XXX instead of /auth/callback?token=XXX
    const token = searchParams.get('token')
    
    if (token) {
      console.log('[Home Page] OAuth token received, processing...')
      saveToken(token, true)
      // redirectAfterAuth will check for onboarding payment flag and handle accordingly
      redirectAfterAuth()
    }
  }, [searchParams])

  return null
}

function HomeContent() {
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

export default function AethermindPage() {
  return (
    <>
      <Suspense fallback={null}>
        <OAuthHandler />
      </Suspense>
      <HomeContent />
    </>
  )
}
