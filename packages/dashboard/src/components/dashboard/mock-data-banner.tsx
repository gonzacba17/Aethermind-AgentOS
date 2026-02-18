"use client"

import { useMockDataContext } from "@/contexts/MockDataContext"

export function MockDataBanner() {
  const { isMockActive } = useMockDataContext()

  if (!isMockActive) return null

  return (
    <div className="bg-yellow-500 text-black text-sm px-4 py-2 text-center">
      Showing demo data — API not available. Configure NEXT_PUBLIC_API_URL to connect to your backend.
    </div>
  )
}
