"use client"

import { useState, useCallback } from "react"
import { DollarSign, TrendingUp, TrendingDown, Download, RefreshCw, Loader2, Calendar, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { 
  useCostSummary, 
  useDailyCosts, 
  useCostsByModel, 
  useBudget, 
  useCostPrediction, 
  exportCostReport,
  getBudgetProgressInfo 
} from "@/hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, AreaChart, Area } from "recharts"
import { CostPrediction, CostRecommendations } from "@/components/costs"

const TIME_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
]

// Color palette for models
const MODEL_COLORS: Record<string, string> = {
  'gpt-4': '#8b5cf6',
  'gpt-4-turbo': '#a78bfa',
  'gpt-3.5-turbo': '#10b981',
  'claude-3': '#3b82f6',
  'claude-3-opus': '#1d4ed8',
  'claude-3-sonnet': '#60a5fa',
  'claude-3-haiku': '#93c5fd',
}

function getColorForModel(model: string): string {
  const lowerModel = model.toLowerCase()
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lowerModel.includes(key)) return color
  }
  return '#64748b'
}

export default function CostsPage() {
  const { toast } = useToast()
  
  // State
  const [timeRange, setTimeRange] = useState("month")
  const [isExporting, setIsExporting] = useState(false)
  
  // Data fetching
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch } = useCostSummary()
  const { data: dailyCosts, isLoading: dailyLoading } = useDailyCosts(timeRange)
  const { data: costsByModel, isLoading: modelLoading } = useCostsByModel(timeRange)
  const { data: budget, isLoading: budgetLoading } = useBudget()
  const { data: prediction } = useCostPrediction()
  
  const isLoading = summaryLoading || dailyLoading || modelLoading || budgetLoading
  
  // Chart data
  const chartData = (dailyCosts || []).map(day => ({
    ...day,
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  })).reverse()
  
  const modelChartData = (costsByModel || []).map(item => ({
    ...item,
    color: getColorForModel(item.model),
  }))
  
  // Budget info
  const budgetInfo = budget ? getBudgetProgressInfo(budget.percentUsed) : null
  
  // Handlers
  const handleExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      await exportCostReport(timeRange, format)
      toast({
        title: "Report Exported",
        description: `Cost report exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export report",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }
  
  // Loading state
  if (isLoading && !summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  // Error state
  if (summaryError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <DollarSign className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Costs</h1>
            <p className="text-muted-foreground">Monitor and analyze your AI costs</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load cost data</div>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCost = summary?.total || 0
  const totalTokens = summary?.totalTokens || 0
  const executionCount = summary?.executionCount || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <DollarSign className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Costs</h1>
            <p className="text-muted-foreground">Monitor and analyze your AI costs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')} disabled>
                Export as PDF (Coming Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold text-foreground">${totalCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {TIME_RANGES.find(r => r.value === timeRange)?.label}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalTokens >= 1000000 
                    ? `${(totalTokens / 1000000).toFixed(1)}M` 
                    : totalTokens >= 1000 
                    ? `${(totalTokens / 1000).toFixed(1)}K`
                    : totalTokens.toLocaleString()
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {executionCount} executions
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projected (Month)</p>
                <p className="text-2xl font-bold text-foreground">
                  ${prediction?.projectedMonthEnd.toFixed(2) || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {prediction?.confidence || 0}% confidence
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <TrendingUp className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={budget?.isOverBudget ? 'border-destructive/50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="text-2xl font-bold text-foreground">
                  {budget?.limit ? `$${budget.limit.toFixed(0)}` : 'Not Set'}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${budgetInfo?.bgColor || 'bg-muted'}`}>
                {budget?.isOverBudget ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <DollarSign className={`h-5 w-5 ${budgetInfo?.color || 'text-muted-foreground'}`} />
                )}
              </div>
            </div>
            {budget && budget.limit > 0 && (
              <>
                <Progress value={Math.min(budget.percentUsed, 100)} className="h-2" />
                <div className="flex justify-between text-xs mt-1">
                  <span className={budgetInfo?.color}>{budget.percentUsed.toFixed(0)}% used</span>
                  <span className="text-muted-foreground">${budget.remaining.toFixed(0)} left</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Costs Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Costs</CardTitle>
            <CardDescription>Cost breakdown over time</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11} 
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11} 
                      tickFormatter={(v) => `$${v}`}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#costGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Costs by Model Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Costs by Model</CardTitle>
            <CardDescription>Distribution across AI models</CardDescription>
          </CardHeader>
          <CardContent>
            {modelChartData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelChartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis 
                      type="number"
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11} 
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis 
                      dataKey="model" 
                      type="category"
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `$${value.toFixed(2)} (${props.payload.usage}%)`,
                        'Cost'
                      ]}
                    />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                      {modelChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
          <CardDescription>Detailed daily cost analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {!dailyCosts || dailyCosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No daily cost data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Cost</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Tokens</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Executions</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCosts.map((day, index) => (
                    <tr key={day.date} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">
                        {new Date(day.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium">
                        ${day.cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                        {day.tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                        {day.executions}
                      </td>
                      <td className="py-3 px-4 text-right text-sm">
                        {day.change !== 0 && (
                          <Badge 
                            variant="outline" 
                            className={day.change > 0 
                              ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }
                          >
                            <span className="flex items-center gap-1">
                              {day.change > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {Math.abs(day.change).toFixed(1)}%
                            </span>
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Prediction */}
      <CostPrediction />

      {/* Cost Recommendations */}
      <CostRecommendations />
    </div>
  )
}
