import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { ActiveAgents } from "@/components/dashboard/active-agents"
import { LogsPanel } from "@/components/dashboard/logs-panel"
import { TracesChart } from "@/components/dashboard/traces-chart"
import { CostsBreakdown } from "@/components/dashboard/costs-breakdown"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {/* KPI Stats */}
          <StatsCards />

          {/* Charts row - Traces and Costs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TracesChart />
            <CostsBreakdown />
          </div>

          {/* Active Agents and Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActiveAgents />
            <LogsPanel />
          </div>
        </main>
      </div>
    </div>
  )
}
