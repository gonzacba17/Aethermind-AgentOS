import { StatsCards } from "@/components/dashboard/stats-cards"
import { ActiveAgents } from "@/components/dashboard/active-agents"
import { LogsPanel } from "@/components/dashboard/logs-panel"
import { TracesChart } from "@/components/dashboard/traces-chart"
import { CostsBreakdown } from "@/components/dashboard/costs-breakdown"

export default function DashboardPage() {
  return (
    <>
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
    </>
  )
}
