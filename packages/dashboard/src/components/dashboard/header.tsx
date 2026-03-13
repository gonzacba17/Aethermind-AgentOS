"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Home, Settings, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_URL, LANDING_PAGE_URL } from "@/lib/config"

export function DashboardHeader() {
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) })
        if (!cancelled) setApiConnected(res.ok)
      } catch {
        if (!cancelled) setApiConnected(false)
      }
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <header className="flex items-center justify-between px-6 h-12 border-b border-white/[0.06] bg-[#0a0a0a]">
      <h1 className="font-light text-[1.25rem] text-white">Dashboard</h1>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white/35 hover:text-white/70 rounded-none">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white/35 hover:text-white/70 rounded-none">
          <Settings className="h-5 w-5" />
        </Button>

        <a
          href={LANDING_PAGE_URL}
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          Back to Home
        </a>

        {/* API Status Badge */}
        {apiConnected !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-[4px]",
              apiConnected
                ? "text-[#00BFA5] bg-[rgba(0,191,165,0.08)] border border-[rgba(0,191,165,0.2)]"
                : "text-[#ff4444] bg-[rgba(255,68,68,0.08)] border border-[rgba(255,68,68,0.2)]",
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                apiConnected ? "bg-[#00BFA5] animate-pulse" : "bg-[#ff4444]",
              )}
            />
            {apiConnected ? "API Connected" : "API Disconnected"}
          </span>
        )}
      </div>
    </header>
  )
}
