"use client"

import { useState } from "react"
import {
  Route,
  DollarSign,
  Zap,
  Activity,
  Shield,
  TrendingDown,
  RefreshCw,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  useRoutingRules,
  useUpdateRoutingRules,
  useProviderHealth,
  useOptimizationData,
  useABInsights,
} from "@/hooks/api/useRouting"

const AVAILABLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', tier: 'economy' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'openai', tier: 'economy' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai', tier: 'standard' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai', tier: 'premium' },
  { value: 'gpt-4', label: 'GPT-4', provider: 'openai', tier: 'premium' },
  { value: 'o1-preview', label: 'o1 Preview', provider: 'openai', tier: 'premium' },
  { value: 'o1-mini', label: 'o1 Mini', provider: 'openai', tier: 'standard' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', provider: 'anthropic', tier: 'economy' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'anthropic', tier: 'standard' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'anthropic', tier: 'premium' },
]

const STATUS_CONFIG = {
  ok: { color: 'bg-emerald-500', label: 'Healthy', icon: CheckCircle2, badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  degraded: { color: 'bg-amber-500', label: 'Degraded', icon: AlertTriangle, badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  down: { color: 'bg-red-500', label: 'Down', icon: XCircle, badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20' },
}

export default function RoutingPage() {
  const { toast } = useToast()

  // API hooks
  const { data: rules, isLoading: rulesLoading } = useRoutingRules()
  const updateRules = useUpdateRoutingRules()
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useProviderHealth()
  const { data: optimization, isLoading: optimizationLoading } = useOptimizationData('30d')
  const { data: abInsights, isLoading: insightsLoading } = useABInsights('30d')

  // Local state for form
  const [simpleModel, setSimpleModel] = useState<string | null>(null)
  const [mediumModel, setMediumModel] = useState<string | null>(null)
  const [complexModel, setComplexModel] = useState<string | null>(null)

  // Derived values
  const isEnabled = rules?.enabled ?? false
  const effectiveSimple = simpleModel ?? rules?.simpleModel ?? 'gpt-4o-mini'
  const effectiveMedium = mediumModel ?? rules?.mediumModel ?? 'gpt-4o-mini'
  const effectiveComplex = complexModel ?? rules?.complexModel ?? 'gpt-4o'

  const handleToggle = async (enabled: boolean) => {
    try {
      await updateRules.mutateAsync({
        enabled,
        simpleModel: effectiveSimple,
        mediumModel: effectiveMedium,
        complexModel: effectiveComplex,
      })
      toast({
        title: enabled ? "Model Routing Enabled" : "Model Routing Disabled",
        description: enabled
          ? "Your prompts will now be automatically routed to optimal models."
          : "All prompts will use the original model.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update routing configuration",
        variant: "destructive",
      })
    }
  }

  const handleSaveRules = async () => {
    try {
      await updateRules.mutateAsync({
        enabled: isEnabled,
        simpleModel: effectiveSimple,
        mediumModel: effectiveMedium,
        complexModel: effectiveComplex,
      })
      toast({
        title: "Configuration Saved",
        description: "Model routing rules have been updated.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to save routing rules",
        variant: "destructive",
      })
    }
  }

  // Loading state
  if (rulesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Route className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Model Routing</h1>
            <p className="text-muted-foreground">Automatic cost optimization — save 30-50% transparently</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="routing-toggle" className="text-sm text-muted-foreground">
              {isEnabled ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id="routing-toggle"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={updateRules.isPending}
            />
          </div>
        </div>
      </div>

      {/* Optimization Opportunities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Est. Monthly Savings</p>
                <p className="text-2xl font-bold text-emerald-500">
                  ${optimization?.estimatedMonthlySavings?.toFixed(2) ?? '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingDown className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost (30d)</p>
                <p className="text-2xl font-bold text-foreground">
                  ${optimization?.totalCost?.toFixed(2) ?? '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Routed Requests</p>
                <p className="text-2xl font-bold text-foreground">
                  {optimization?.routedRequests ?? 0}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Zap className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Redirectable</p>
                <p className="text-2xl font-bold text-foreground">
                  {optimization?.redirectablePercent?.toFixed(1) ?? '0'}%
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Routing Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-500" />
                Routing Configuration
              </CardTitle>
              <CardDescription>
                Configure which models to use for each complexity level.
                Simple prompts get cheaper models, complex ones keep premium models.
              </CardDescription>
            </div>
            <Button
              onClick={handleSaveRules}
              disabled={updateRules.isPending}
              className="gap-2"
            >
              {updateRules.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Simple */}
            <div className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Simple
                </Badge>
                <span className="text-xs text-muted-foreground">&lt; 200 tokens, no reasoning</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Greetings, translations, lookups, simple Q&A
              </p>
              <Select value={effectiveSimple} onValueChange={setSimpleModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        {m.label}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {m.tier}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Medium */}
            <div className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  Medium
                </Badge>
                <span className="text-xs text-muted-foreground">200-800 tokens or 1-2 keywords</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Summarization, code generation, content writing
              </p>
              <Select value={effectiveMedium} onValueChange={setMediumModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        {m.label}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {m.tier}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Complex */}
            <div className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                  Complex
                </Badge>
                <span className="text-xs text-muted-foreground">&gt; 800 tokens or 3+ reasoning keywords</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Multi-step analysis, deep reasoning, synthesis
              </p>
              <Select value={effectiveComplex} onValueChange={setComplexModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        {m.label}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {m.tier}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
            <h4 className="text-sm font-medium text-foreground mb-2">How it works</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded bg-background border">Your prompt</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20">Classify</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 rounded bg-background border">Route to model</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Save costs</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              If the routed model fails, the system automatically retries with the original model. Zero quality loss guaranteed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Provider Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Provider Health
              </CardTitle>
              <CardDescription>
                Real-time health monitoring of LLM providers. Checked every 2 minutes.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHealth()}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {healthData?.providers?.map(provider => {
                const config = STATUS_CONFIG[provider.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ok
                const StatusIcon = config.icon
                return (
                  <div
                    key={provider.provider}
                    className="p-4 rounded-lg border bg-card space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium capitalize text-foreground">{provider.provider}</h4>
                      <Badge variant="outline" className={config.badgeClass}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Latency</span>
                        <span className="text-foreground font-medium">
                          {provider.latencyMs != null ? `${provider.latencyMs}ms` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg 24h</span>
                        <span className="text-foreground font-medium">
                          {provider.avg24hLatency != null ? `${provider.avg24hLatency}ms` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Requests 24h</span>
                        <span className="text-foreground font-medium">{provider.requests24h}</span>
                      </div>
                    </div>
                    {provider.errorMessage && (
                      <p className="text-xs text-red-500 truncate" title={provider.errorMessage}>
                        {provider.errorMessage}
                      </p>
                    )}
                  </div>
                )
              })}
              {(!healthData?.providers || healthData.providers.length === 0) && (
                <div className="col-span-3 text-center py-8 text-muted-foreground">
                  No provider health data yet. Data will appear after the first check cycle.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* A/B Insights Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            Routing Insights
          </CardTitle>
          <CardDescription>
            Performance comparison between original and routed models (last 30 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <Skeleton className="h-48" />
          ) : abInsights?.data && abInsights.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Original Model</th>
                    <th className="py-2 pr-4 font-medium">Routed To</th>
                    <th className="py-2 pr-4 font-medium text-right">Requests</th>
                    <th className="py-2 pr-4 font-medium text-right">Avg Cost</th>
                    <th className="py-2 pr-4 font-medium text-right">Avg Latency</th>
                    <th className="py-2 pr-4 font-medium text-right">Fallbacks</th>
                  </tr>
                </thead>
                <tbody>
                  {abInsights.data.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="py-2 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.originalModel}</code>
                      </td>
                      <td className="py-2 pr-4">
                        <code className="text-xs bg-violet-500/10 text-violet-500 px-1.5 py-0.5 rounded">{row.routedModel}</code>
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">{row.count.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">${row.avgCost.toFixed(4)}</td>
                      <td className="py-2 pr-4 text-right">{row.avgLatency}ms</td>
                      <td className="py-2 pr-4 text-right">
                        {row.fallbackCount > 0 ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                            {row.fallbackCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Route className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No routing data yet</p>
              <p className="text-sm mt-1">
                Enable model routing above, and insights will appear as your SDK sends requests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
