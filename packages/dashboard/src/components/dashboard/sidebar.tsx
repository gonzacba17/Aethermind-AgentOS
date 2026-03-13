"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, LayoutDashboard, Bot, GitBranch, DollarSign, ChevronLeft, ChevronRight, Settings, Bell, Wallet, TrendingUp, Sparkles, Route, Lightbulb, LogOut, Network } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/useAuthStore"
import { LANDING_PAGE_URL } from "@/lib/config"

const navGroups = [
  {
    label: "Overview",
    items: [
      { icon: Home, label: "Home", href: "/home" },
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    label: "AI Operations",
    items: [
      { icon: GitBranch, label: "Traces", href: "/traces" },
      { icon: Network, label: "Workflows", href: "/workflows" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { icon: GitBranch, label: "Logs", href: "/logs" },
      { icon: DollarSign, label: "Costs", href: "/costs" },
      { icon: Wallet, label: "Budgets", href: "/budgets" },
      { icon: TrendingUp, label: "Forecasting", href: "/forecasting" },
      { icon: Sparkles, label: "Optimization", href: "/optimization" },
      { icon: Route, label: "Model Routing", href: "/routing" },
      { icon: Lightbulb, label: "Insights", href: "/insights" },
      { icon: Bell, label: "Alerts", href: "/settings/alerts" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: Settings, label: "Settings", href: "/settings" },
      { icon: Bot, label: "Agent Config", href: "/agent-config" },
    ],
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    window.location.href = `${LANDING_PAGE_URL}/login?logout=true`
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-[#0a0a0a] border-r border-white/[0.06] transition-all duration-300",
        collapsed ? "w-16" : "w-[180px]",
      )}
    >
      {/* Logo section */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
        <div className={cn("flex items-center", collapsed && "justify-center w-full")}>
          {collapsed ? (
            <span className="text-white font-light text-[11px] tracking-[0.15em]">A</span>
          ) : (
            <div className="flex flex-col">
              <span className="font-light text-[11px] tracking-[0.15em] text-white">AETHERMIND</span>
              <span className="text-[10px] text-white/30 font-mono">AgentOS</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full justify-center text-white/35 hover:text-white/70 hover:bg-white/[0.03] rounded-none")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation grouped by category */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mt-6 first:mt-0">
            {!collapsed && (
              <span className="px-3 font-mono text-[9px] text-white/20 uppercase tracking-[0.12em]">
                {group.label}
              </span>
            )}
            <div className="mt-2 space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-none text-[0.8rem] font-light transition-colors",
                      collapsed && "justify-center",
                      isActive
                        ? "border-l-2 border-[#00BFA5] text-white"
                        : "text-white/45 hover:text-white/70 hover:bg-white/[0.03] border-l-2 border-transparent",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white/80" : "text-white/35")} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout + Version footer */}
      <div className="px-3 py-3 border-t border-white/[0.06] space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full text-white/30 hover:text-white/60 hover:bg-white/[0.03] rounded-none",
            collapsed ? "justify-center" : "justify-start gap-3 px-3"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </Button>
        {!collapsed ? (
          <span className="text-[10px] text-white/20 font-mono block px-3">Aethermind AgentOS v0.1.0</span>
        ) : (
          <span className="text-[10px] text-white/20 font-mono text-center block">v0.1</span>
        )}
      </div>
    </aside>
  )
}
