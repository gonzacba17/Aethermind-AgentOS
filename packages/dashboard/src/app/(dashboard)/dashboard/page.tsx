import { StatsCards } from "@/components/dashboard/stats-cards"
import { ActiveAgents } from "@/components/dashboard/active-agents"
import { LogsPanel } from "@/components/dashboard/logs-panel"
import { TracesChart } from "@/components/dashboard/traces-chart"
import { CostsBreakdown } from "@/components/dashboard/costs-breakdown"
import { CostTimeseriesChart } from "@/components/dashboard/cost-timeseries-chart"
import { ForecastCard } from "@/components/dashboard/forecast-card"
import { BudgetManagementCard } from "@/components/dashboard/budget-management-card"
import { AgentCostsTable } from "@/components/dashboard/agent-costs-table"
import { PeriodComparisonCard } from "@/components/dashboard/period-comparison-card"
import { CacheStatsCard } from "@/components/dashboard/cache-stats-card"
import { CacheSettingsCard } from "@/components/dashboard/cache-settings-card"
import { BenchmarkCard } from "@/components/dashboard/benchmark-card"
import { UsageInsightsCard } from "@/components/dashboard/usage-insights-card"

export default function DashboardPage() {
  return (
    <>
      {/* KPI Stats */}
      <StatsCards />

      {/* Learning Engine — Phase 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BenchmarkCard />
        <UsageInsightsCard />
      </div>

      {/* Forecast & Budget — Phase 1 Cost Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ForecastCard />
        <BudgetManagementCard />
      </div>

      {/* Semantic Cache — Phase 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CacheStatsCard />
        <CacheSettingsCard />
      </div>

      {/* Charts row - Traces and Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TracesChart />
        <CostsBreakdown />
      </div>

      {/* Cost Trend */}
      <CostTimeseriesChart />

      {/* Analytics — Agent costs & Period comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentCostsTable />
        <PeriodComparisonCard />
      </div>

      {/* Active Agents and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActiveAgents />
        <LogsPanel />
      </div>
    </>
  )
}
