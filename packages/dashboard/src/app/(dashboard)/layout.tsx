import type React from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { MockDataBanner } from "@/components/dashboard/mock-data-banner"
import { TrialBanner } from "@/components/dashboard/trial-banner"
import { AuthGuard } from "@/components/AuthGuard"
import { OnboardingGate } from "@/components/OnboardingGate"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="flex min-h-screen bg-background">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col">
            <TrialBanner />
            <MockDataBanner />
            <DashboardHeader />
            <main className="flex-1 p-6 space-y-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </OnboardingGate>
    </AuthGuard>
  )
}
