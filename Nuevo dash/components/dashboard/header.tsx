"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, Settings, Bell } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const apiConnected = false

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="gap-2 bg-transparent border-border text-foreground hover:bg-secondary"
        >
          <Link href="/">
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* API Status Badge */}
        <span
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium",
            apiConnected ? "bg-primary/20 text-primary" : "bg-destructive text-destructive-foreground",
          )}
        >
          {apiConnected ? "API Connected" : "API Disconnected"}
        </span>
      </div>
    </header>
  )
}
