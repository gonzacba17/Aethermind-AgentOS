import type React from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { MockDataProvider } from "@/contexts/MockDataContext"
import { MockDataBanner } from "@/components/dashboard/mock-data-banner"
import { AuthGuard } from "@/components/AuthGuard"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <MockDataProvider>
        <div className="flex min-h-screen bg-background">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col">
            <MockDataBanner />
            <DashboardHeader />
            <main className="flex-1 p-6 space-y-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </MockDataProvider>
    </AuthGuard>
  )
}
