"use client"

import { shouldUseMockData } from "@/lib/mock-data"

export function MockDataBanner() {
  // Only show banner when API URL is genuinely not configured
  // Don't show just because individual hooks fell back to mock data
  if (!shouldUseMockData()) return null

  return (
    <div className="bg-yellow-500 text-black text-sm px-4 py-2 text-center">
      Showing demo data — API not available. Configure NEXT_PUBLIC_API_URL to connect to your backend.
    </div>
  )
}
