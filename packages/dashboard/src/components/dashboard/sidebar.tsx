"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, LayoutDashboard, Bot, FileText, GitBranch, DollarSign, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

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
      { icon: Bot, label: "Agents", href: "/agents" },
      { icon: GitBranch, label: "Traces", href: "/traces" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { icon: FileText, label: "Logs", href: "/logs" },
      { icon: DollarSign, label: "Costs", href: "/costs" },
    ],
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo section */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-sm">Aethermind</span>
              <span className="text-xs text-muted-foreground">AgentOS Dashboard</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full justify-center text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation grouped by category */}
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </span>
            )}
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      collapsed && "justify-center",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Version footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        {!collapsed ? (
          <span className="text-xs text-muted-foreground">Aethermind AgentOS v0.1.0</span>
        ) : (
          <span className="text-xs text-muted-foreground text-center block">v0.1</span>
        )}
      </div>
    </aside>
  )
}
