"use client"

import { Lightbulb, Clock, AlertTriangle, Cpu, Badge as BadgeIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useClientInsights } from "@/hooks/api/useClientInsights"
import type { ClientInsight } from "@/hooks/api/useClientInsights"

const typeConfig: Record<string, { icon: typeof Lightbulb; label: string; color: string }> = {
  peak_hours: { icon: Clock, label: 'Peak Hours', color: 'text-white/40' },
  underutilized_agent: { icon: AlertTriangle, label: 'Underutilized Agent', color: 'text-white/40' },
  overloaded_agent: { icon: Cpu, label: 'Overloaded Agent', color: 'text-white/40' },
  similar_agents: { icon: BadgeIcon, label: 'Similar Agents', color: 'text-white/40' },
  cache_suggestion: { icon: Lightbulb, label: 'Cache', color: 'text-white/40' },
  routing_suggestion: { icon: Lightbulb, label: 'Routing', color: 'text-white/40' },
}

export function UsageInsightsCard() {
  const { data, isLoading } = useClientInsights()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  const insights = data?.insights ?? []
  const patternInsights = insights.filter((i) =>
    ['peak_hours', 'underutilized_agent', 'overloaded_agent', 'similar_agents'].includes(i.type),
  )

  if (patternInsights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-white/40" />
            Usage Insights
          </CardTitle>
          <CardDescription>Patterns detected in your data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/40">No usage patterns detected yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-white/40" />
          Usage Insights
          {patternInsights.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {patternInsights.length} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Patterns detected in your data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {patternInsights.slice(0, 5).map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
      </CardContent>
    </Card>
  )
}

function InsightRow({ insight }: { insight: ClientInsight }) {
  const config = typeConfig[insight.type] ?? typeConfig.peak_hours!
  const Icon = config.icon

  const summary = getInsightSummary(insight)

  return (
    <div className="flex items-start gap-3 p-2 rounded-none hover:bg-white/[0.03]">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-white/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{config.label}</span>
          {!insight.acknowledged && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              New
            </Badge>
          )}
        </div>
        <p className="text-xs text-white/30 truncate">{summary}</p>
      </div>
      {insight.estimatedSavingsUsd && (
        <span className="text-xs font-medium text-[#00BFA5] whitespace-nowrap">
          ~${insight.estimatedSavingsUsd.toFixed(2)}
        </span>
      )}
    </div>
  )
}

function getInsightSummary(insight: ClientInsight): string {
  const data = insight.data as Record<string, unknown>

  switch (insight.type) {
    case 'peak_hours': {
      const peaks = data.peakHours as Array<{ hour: number; totalCost: number }> | undefined
      if (peaks?.length) {
        return `Peak spending at ${peaks.map((p) => `${p.hour}:00`).join(', ')}`
      }
      return 'Peak spending hours detected'
    }
    case 'underutilized_agent':
      return `Agent ${data.agentId ?? 'unknown'}: ${data.recentRequests ?? 0} recent requests (previously: ${data.previousRequests ?? 0})`
    case 'overloaded_agent':
      return `Agent ${data.agentId ?? 'unknown'}: average latency ${data.avgLatencyMs ?? 0}ms`
    case 'similar_agents':
      return `${data.agentIdA ?? '?'} and ${data.agentIdB ?? '?'} have similar prompts (${((data.similarity as number) * 100).toFixed(0)}%)`
    default:
      return JSON.stringify(data).substring(0, 80)
  }
}
