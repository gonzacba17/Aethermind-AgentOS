"use client"

import { useState } from "react"
import { Sparkles, DollarSign, Zap, RefreshCw, Calculator, ArrowRight, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  useOptimizationReport,
  useAvailableModels,
  useRoutingRules,
  useEstimateCost,
  useFindAlternatives,
} from "@/hooks/api/useOptimization"

export default function OptimizationPage() {
  const { toast } = useToast()

  // State
  const [selectedModel, setSelectedModel] = useState('gpt-4')
  const [inputTokens, setInputTokens] = useState(1000)
  const [outputTokens, setOutputTokens] = useState(500)
  const [costEstimate, setCostEstimate] = useState<any>(null)
  const [alternatives, setAlternatives] = useState<any>(null)

  // API hooks
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useOptimizationReport()
  const { data: modelsData, isLoading: modelsLoading } = useAvailableModels()
  const { data: rulesData, isLoading: rulesLoading } = useRoutingRules()
  const estimateCost = useEstimateCost()
  const findAlternatives = useFindAlternatives()

  const models = modelsData?.models || []
  const rules = rulesData?.rules || []

  const handleEstimate = async () => {
    try {
      const result = await estimateCost.mutateAsync({
        model: selectedModel,
        inputTokens,
        outputTokens,
      })
      setCostEstimate(result)
    } catch (error) {
      toast({ title: "Error", description: "Failed to estimate cost", variant: "destructive" })
    }
  }

  const handleFindAlternatives = async () => {
    try {
      const result = await findAlternatives.mutateAsync({ model: selectedModel })
      setAlternatives(result)
    } catch (error) {
      toast({ title: "Error", description: "Failed to find alternatives", variant: "destructive" })
    }
  }

  const impactColors = {
    high: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  }

  const isLoading = reportLoading || modelsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Optimization</h1>
            <p className="text-muted-foreground">Reduce costs and improve efficiency</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetchReport()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost (30d)</p>
                <p className="text-2xl font-bold text-foreground">
                  ${report?.summary.totalCost.toFixed(2) || '0.00'}
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
                <p className="text-sm text-muted-foreground">Potential Savings</p>
                <p className="text-2xl font-bold text-emerald-500">
                  ${report?.summary.potentialSavings.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inefficiencies</p>
                <p className="text-2xl font-bold text-foreground">
                  {report?.summary.inefficiencies || 0}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recommendations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="estimator">Cost Estimator</TabsTrigger>
          <TabsTrigger value="rules">Routing Rules</TabsTrigger>
        </TabsList>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>AI-generated suggestions to reduce costs</CardDescription>
            </CardHeader>
            <CardContent>
              {report?.recommendations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations at this time</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {report?.recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{rec.title}</h3>
                            <Badge variant="outline" className={impactColors[rec.impact]}>
                              {rec.impact} impact
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Implementation: {rec.implementation}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-emerald-500">
                            ${rec.estimatedSavings.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">potential savings</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Models</CardTitle>
              <CardDescription>Compare pricing across different AI models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Model</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Provider</th>
                      <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Input $/1K</th>
                      <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Output $/1K</th>
                      <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Context</th>
                      <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Capabilities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.model} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <span className="font-medium">{model.model}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">{model.provider}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          ${model.pricing.inputPer1kTokens.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          ${model.pricing.outputPer1kTokens.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(model.contextWindow / 1000).toFixed(0)}K
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {model.capabilities.slice(0, 3).map(cap => (
                              <Badge key={cap} variant="secondary" className="text-xs">{cap}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Estimator Tab */}
        <TabsContent value="estimator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Cost Estimator
                </CardTitle>
                <CardDescription>Calculate costs for your API calls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inputTokens">Input Tokens</Label>
                    <Input
                      id="inputTokens"
                      type="number"
                      min="0"
                      value={inputTokens}
                      onChange={(e) => setInputTokens(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outputTokens">Output Tokens</Label>
                    <Input
                      id="outputTokens"
                      type="number"
                      min="0"
                      value={outputTokens}
                      onChange={(e) => setOutputTokens(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEstimate} disabled={estimateCost.isPending} className="flex-1">
                    {estimateCost.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Estimate Cost
                  </Button>
                  <Button onClick={handleFindAlternatives} disabled={findAlternatives.isPending} variant="outline" className="flex-1">
                    {findAlternatives.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Find Alternatives
                  </Button>
                </div>

                {costEstimate && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Input Cost</span>
                      <span className="font-mono">${costEstimate.breakdown.inputCost.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Output Cost</span>
                      <span className="font-mono">${costEstimate.breakdown.outputCost.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Total</span>
                      <span className="font-bold">${costEstimate.estimatedCost.toFixed(6)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cheaper Alternatives</CardTitle>
                <CardDescription>Models that could save you money</CardDescription>
              </CardHeader>
              <CardContent>
                {!alternatives ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Find Alternatives" to see cheaper options</p>
                  </div>
                ) : alternatives.alternatives.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No cheaper alternatives found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alternatives.alternatives.map((alt: any) => (
                      <div key={alt.model} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alt.model}</span>
                            <Badge variant="outline" className="capitalize text-xs">{alt.provider}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{alt.tradeoffs}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-500">
                            {alt.savingsPercent.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">savings</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Routing Rules Tab */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Routing Rules</CardTitle>
              <CardDescription>Automatic model selection based on conditions</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No routing rules configured</p>
                  <p className="text-sm mt-2">Rules automatically route requests to optimal models</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{rule.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Priority: {rule.priority} | Action: {rule.action.type}
                            {rule.action.model && ` to ${rule.action.model}`}
                          </p>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
