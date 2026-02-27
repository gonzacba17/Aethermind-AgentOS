"use client"

import { useState } from "react"
import { Lightbulb, Check, X, History, DollarSign, Clock, AlertTriangle, Cpu, Link2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  useClientInsights,
  useClientInsightsHistory,
  useApplyInsight,
  useDismissInsight,
} from "@/hooks/api/useClientInsights"
import type { ClientInsight } from "@/hooks/api/useClientInsights"

const typeConfig: Record<string, { icon: typeof Lightbulb; label: string; color: string }> = {
  peak_hours: { icon: Clock, label: 'Horas pico', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  underutilized_agent: { icon: AlertTriangle, label: 'Agente subutilizado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  overloaded_agent: { icon: Cpu, label: 'Agente sobrecargado', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  similar_agents: { icon: Link2, label: 'Agentes similares', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  cache_suggestion: { icon: Lightbulb, label: 'Sugerencia de cache', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  routing_suggestion: { icon: Lightbulb, label: 'Sugerencia de routing', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
}

export default function InsightsPage() {
  const { toast } = useToast()
  const { data: pendingData, isLoading: loadingPending } = useClientInsights()
  const { data: historyData, isLoading: loadingHistory } = useClientInsightsHistory()
  const applyMutation = useApplyInsight()
  const dismissMutation = useDismissInsight()

  const pendingInsights = pendingData?.insights ?? []
  const allInsights = historyData?.insights ?? []
  const appliedInsights = allInsights.filter((i) => i.appliedAt)
  const dismissedInsights = allInsights.filter((i) => i.dismissedAt)

  const handleApply = async (insightId: string) => {
    try {
      await applyMutation.mutateAsync(insightId)
      toast({ title: 'Sugerencia aplicada', description: 'La configuracion se ha actualizado.' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo aplicar la sugerencia.', variant: 'destructive' })
    }
  }

  const handleDismiss = async (insightId: string) => {
    try {
      await dismissMutation.mutateAsync(insightId)
      toast({ title: 'Sugerencia descartada' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo descartar la sugerencia.', variant: 'destructive' })
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Sugerencias de optimizacion basadas en tus datos de uso
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Pendientes"
          value={pendingInsights.length}
          icon={<Lightbulb className="h-4 w-4" />}
          loading={loadingPending}
        />
        <SummaryCard
          label="Aplicadas"
          value={appliedInsights.length}
          icon={<Check className="h-4 w-4" />}
          loading={loadingHistory}
        />
        <SummaryCard
          label="Ahorro estimado"
          value={`$${pendingInsights
            .reduce((sum, i) => sum + (i.estimatedSavingsUsd ?? 0), 0)
            .toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loadingPending}
        />
      </div>

      {/* Tabs: Pending / History */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pendientes
            {pendingInsights.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {pendingInsights.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5 mr-1.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {loadingPending ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : pendingInsights.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No hay sugerencias pendientes. El sistema analiza tus datos cada semana.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onApply={() => handleApply(insight.id)}
                onDismiss={() => handleDismiss(insight.id)}
                applyLoading={applyMutation.isPending}
                dismissLoading={dismissMutation.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          {loadingHistory ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          ) : allInsights.filter((i) => i.appliedAt || i.dismissedAt).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <History className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No hay historial de sugerencias todavia.
                </p>
              </CardContent>
            </Card>
          ) : (
            allInsights
              .filter((i) => i.appliedAt || i.dismissedAt)
              .map((insight) => (
                <HistoryCard key={insight.id} insight={insight} />
              ))
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function InsightCard({
  insight,
  onApply,
  onDismiss,
  applyLoading,
  dismissLoading,
}: {
  insight: ClientInsight
  onApply: () => void
  onDismiss: () => void
  applyLoading: boolean
  dismissLoading: boolean
}) {
  const config = typeConfig[insight.type] ?? typeConfig.peak_hours!
  const Icon = config.icon
  const data = insight.data as Record<string, unknown>
  const isActionable = insight.type === 'cache_suggestion' || insight.type === 'routing_suggestion'

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{config.label}</span>
              <Badge variant="outline" className="text-[10px]">
                Nuevo
              </Badge>
              {insight.estimatedSavingsUsd && (
                <Badge variant="secondary" className="text-[10px] text-green-600">
                  ~${insight.estimatedSavingsUsd.toFixed(2)} ahorro
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {(data.reason as string) || getInsightDescription(insight)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(insight.createdAt).toLocaleDateString()}
            </p>
          </div>
          {isActionable && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={onDismiss}
                disabled={dismissLoading}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={onApply}
                disabled={applyLoading}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Aplicar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function HistoryCard({ insight }: { insight: ClientInsight }) {
  const config = typeConfig[insight.type] ?? typeConfig.peak_hours!
  const Icon = config.icon
  const isApplied = !!insight.appliedAt

  return (
    <Card className="opacity-75">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <span className="font-medium text-sm">{config.label}</span>
            <p className="text-xs text-muted-foreground">
              {new Date(insight.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={isApplied ? 'default' : 'secondary'}>
            {isApplied ? 'Aplicada' : 'Descartada'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function getInsightDescription(insight: ClientInsight): string {
  const data = insight.data as Record<string, unknown>
  switch (insight.type) {
    case 'peak_hours': {
      const peaks = data.peakHours as Array<{ hour: number }> | undefined
      return `Tus horas de mayor gasto: ${peaks?.map((p) => `${p.hour}:00`).join(', ') ?? 'N/A'}`
    }
    case 'underutilized_agent':
      return `Agente ${data.agentId}: solo ${data.recentRequests} requests recientes (antes: ${data.previousRequests})`
    case 'overloaded_agent':
      return `Agente ${data.agentId}: latencia promedio ${data.avgLatencyMs}ms`
    case 'similar_agents':
      return `Los agentes ${data.agentIdA} y ${data.agentIdB} tienen system prompts similares (${((data.similarity as number) * 100).toFixed(0)}%)`
    default:
      return ''
  }
}
