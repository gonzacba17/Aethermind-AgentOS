"use client"

import { Lightbulb, Clock, AlertTriangle, Cpu, Badge as BadgeIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useClientInsights } from "@/hooks/api/useClientInsights"
import type { ClientInsight } from "@/hooks/api/useClientInsights"

const typeConfig: Record<string, { icon: typeof Lightbulb; label: string; color: string }> = {
  peak_hours: { icon: Clock, label: 'Horas pico', color: 'bg-blue-100 text-blue-700' },
  underutilized_agent: { icon: AlertTriangle, label: 'Agente subutilizado', color: 'bg-yellow-100 text-yellow-700' },
  overloaded_agent: { icon: Cpu, label: 'Agente sobrecargado', color: 'bg-red-100 text-red-700' },
  similar_agents: { icon: BadgeIcon, label: 'Agentes similares', color: 'bg-purple-100 text-purple-700' },
  cache_suggestion: { icon: Lightbulb, label: 'Cache', color: 'bg-green-100 text-green-700' },
  routing_suggestion: { icon: Lightbulb, label: 'Routing', color: 'bg-indigo-100 text-indigo-700' },
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
            <Lightbulb className="h-4 w-4" />
            Insights de uso
          </CardTitle>
          <CardDescription>Patrones detectados en tus datos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No se han detectado patrones de uso todavia.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          Insights de uso
          {patternInsights.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {patternInsights.length} nuevo{patternInsights.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Patrones detectados en tus datos</CardDescription>
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
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
      <div className={`mt-0.5 p-1.5 rounded-md ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.label}</span>
          {!insight.acknowledged && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Nuevo
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{summary}</p>
      </div>
      {insight.estimatedSavingsUsd && (
        <span className="text-xs font-medium text-green-600 whitespace-nowrap">
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
        return `Mayor gasto a las ${peaks.map((p) => `${p.hour}:00`).join(', ')}`
      }
      return 'Horas de mayor gasto detectadas'
    }
    case 'underutilized_agent':
      return `Agente ${data.agentId ?? 'desconocido'}: ${data.recentRequests ?? 0} requests recientes (antes: ${data.previousRequests ?? 0})`
    case 'overloaded_agent':
      return `Agente ${data.agentId ?? 'desconocido'}: latencia promedio ${data.avgLatencyMs ?? 0}ms`
    case 'similar_agents':
      return `${data.agentIdA ?? '?'} y ${data.agentIdB ?? '?'} tienen prompts similares (${((data.similarity as number) * 100).toFixed(0)}%)`
    default:
      return JSON.stringify(data).substring(0, 80)
  }
}
