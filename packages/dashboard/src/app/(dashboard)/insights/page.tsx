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
  peak_hours: { icon: Clock, label: 'Peak Hours', color: 'text-white/40' },
  underutilized_agent: { icon: AlertTriangle, label: 'Underutilized Agent', color: 'text-white/40' },
  overloaded_agent: { icon: Cpu, label: 'Overloaded Agent', color: 'text-white/40' },
  similar_agents: { icon: Link2, label: 'Similar Agents', color: 'text-white/40' },
  cache_suggestion: { icon: Lightbulb, label: 'Cache Suggestion', color: 'text-white/40' },
  routing_suggestion: { icon: Lightbulb, label: 'Routing Suggestion', color: 'text-white/40' },
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
      toast({ title: 'Suggestion Applied', description: 'Configuration updated.' })
    } catch {
      toast({ title: 'Error', description: 'Failed to apply suggestion.', variant: 'destructive' })
    }
  }

  const handleDismiss = async (insightId: string) => {
    try {
      await dismissMutation.mutateAsync(insightId)
      toast({ title: 'Suggestion Dismissed' })
    } catch {
      toast({ title: 'Error', description: 'Failed to dismiss suggestion.', variant: 'destructive' })
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Lightbulb className="h-5 w-5 text-white/40" />
        <div>
          <h1 className="text-2xl font-light text-white">Insights</h1>
          <p className="text-sm text-white/40">
            Optimization suggestions based on your usage data
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Pending"
          value={pendingInsights.length}
          icon={<Lightbulb className="h-4 w-4 text-white/15" />}
          loading={loadingPending}
        />
        <SummaryCard
          label="Applied"
          value={appliedInsights.length}
          icon={<Check className="h-4 w-4 text-white/15" />}
          loading={loadingHistory}
        />
        <SummaryCard
          label="Estimated Savings"
          value={`$${pendingInsights
            .reduce((sum, i) => sum + (i.estimatedSavingsUsd ?? 0), 0)
            .toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4 text-white/15" />}
          loading={loadingPending}
        />
      </div>

      {/* Tabs: Pending / History */}
      <Tabs defaultValue="pending">
        <TabsList className="bg-transparent border-b border-white/[0.06] rounded-none w-full justify-start gap-0 p-0">
          <TabsTrigger value="pending" className="rounded-none border-b-2 border-transparent data-[state=active]:border-white/70 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white px-4 py-2">
            Pending
            {pendingInsights.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {pendingInsights.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-white/70 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white px-4 py-2">
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {loadingPending ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : pendingInsights.length === 0 ? (
            <Card className="bg-[#111] border border-white/[0.06] rounded-none">
              <CardContent className="py-8 text-center">
                <Lightbulb className="h-8 w-8 mx-auto text-white/10 mb-3" />
                <p className="text-sm text-white/40">
                  No pending suggestions. The system analyzes your data weekly.
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
            <Card className="bg-[#111] border border-white/[0.06] rounded-none">
              <CardContent className="py-8 text-center">
                <History className="h-8 w-8 mx-auto text-white/10 mb-3" />
                <p className="text-sm text-white/40">
                  No suggestion history yet.
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
    <Card className="bg-[#111] border border-white/[0.06] rounded-none">
      <CardContent className="px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[0.7rem] font-light text-white/35 uppercase tracking-[0.08em]">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-[1.75rem] font-extralight text-white">{value}</p>
            )}
          </div>
          {icon}
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
    <Card className="bg-[#111] border border-white/[0.06] rounded-none">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Icon className="h-4 w-4 text-white/40 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-white">{config.label}</span>
              <Badge variant="outline" className="text-[10px]">
                New
              </Badge>
              {insight.estimatedSavingsUsd && (
                <Badge variant="secondary" className="text-[10px] text-[#00BFA5]">
                  ~${insight.estimatedSavingsUsd.toFixed(2)} savings
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/40">
              {(data.reason as string) || getInsightDescription(insight)}
            </p>
            <p className="text-xs text-white/20 mt-1">
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
                className="rounded-[4px]"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={onApply}
                disabled={applyLoading}
                className="rounded-[4px]"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Apply
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
    <Card className="bg-[#111] border border-white/[0.06] rounded-none opacity-75">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <Icon className="h-4 w-4 text-white/40 shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-sm text-white">{config.label}</span>
            <p className="text-xs text-white/20">
              {new Date(insight.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={isApplied ? 'default' : 'secondary'}>
            {isApplied ? 'Applied' : 'Dismissed'}
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
      return `Peak spending hours: ${peaks?.map((p) => `${p.hour}:00`).join(', ') ?? 'N/A'}`
    }
    case 'underutilized_agent':
      return `Agent ${data.agentId}: only ${data.recentRequests} recent requests (previously: ${data.previousRequests})`
    case 'overloaded_agent':
      return `Agent ${data.agentId}: average latency ${data.avgLatencyMs}ms`
    case 'similar_agents':
      return `Agents ${data.agentIdA} and ${data.agentIdB} have similar system prompts (${((data.similarity as number) * 100).toFixed(0)}%)`
    default:
      return ''
  }
}
