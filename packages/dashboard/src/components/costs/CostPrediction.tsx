"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, AlertTriangle, Info, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Area, AreaChart } from "recharts"
import { useCostPrediction, useBudget, getBudgetProgressInfo } from "@/hooks"
import { Skeleton } from "@/components/ui/skeleton"

interface CostPredictionProps {
  showChart?: boolean;
  compact?: boolean;
}

export function CostPrediction({ showChart = true, compact = false }: CostPredictionProps) {
  const { data: prediction, isLoading: predictionLoading } = useCostPrediction()
  const { data: budget } = useBudget()
  
  // Generate forecast data
  const forecastData = useMemo(() => {
    if (!prediction) return []
    
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const currentDay = now.getDate()
    
    const data = []
    const dailyRate = prediction.currentSpend / currentDay
    
    // Historical data (actual spending)
    for (let i = 1; i <= currentDay; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), i)
      data.push({
        day: i,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        actual: Math.round((dailyRate * i) * 100) / 100,
        projected: null,
        upperBound: null,
        lowerBound: null,
      })
    }
    
    // Projected data (forecast)
    for (let i = currentDay + 1; i <= daysInMonth; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), i)
      const projectedValue = prediction.currentSpend + (dailyRate * (i - currentDay))
      const variance = projectedValue * (1 - prediction.confidence / 100)
      
      data.push({
        day: i,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        actual: null,
        projected: Math.round(projectedValue * 100) / 100,
        upperBound: Math.round((projectedValue + variance) * 100) / 100,
        lowerBound: Math.round((projectedValue - variance) * 100) / 100,
      })
    }
    
    return data
  }, [prediction])
  
  const budgetInfo = budget ? getBudgetProgressInfo(budget.percentUsed) : null
  
  // Risk assessment
  const getRiskLevel = () => {
    if (!prediction || !budget) return null
    
    const projectedPercent = (prediction.projectedMonthEnd / budget.limit) * 100
    
    if (projectedPercent > 120) return { level: 'critical', label: 'Critical', color: 'text-red-500', bg: 'bg-red-500/10' }
    if (projectedPercent > 100) return { level: 'high', label: 'High', color: 'text-orange-500', bg: 'bg-orange-500/10' }
    if (projectedPercent > 80) return { level: 'medium', label: 'Medium', color: 'text-amber-500', bg: 'bg-amber-500/10' }
    return { level: 'low', label: 'Low', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  }
  
  const risk = getRiskLevel()

  if (predictionLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    )
  }

  if (!prediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Prediction</CardTitle>
          <CardDescription>Not enough data to generate prediction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Info className="h-5 w-5 mr-2" />
            Predictions require at least 3 days of usage data
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Cost Prediction
            </CardTitle>
            <CardDescription>Projected spending for this month</CardDescription>
          </div>
          {risk && (
            <Badge variant="outline" className={`${risk.bg} ${risk.color}`}>
              {risk.level === 'critical' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {risk.label} Risk
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Current Spend</p>
            <p className="text-xl font-bold">${prediction.currentSpend.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Projected Total</p>
            <p className="text-xl font-bold">${prediction.projectedMonthEnd.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-xl font-bold">{prediction.confidence}%</p>
          </div>
          {budget && (
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Budget Impact</p>
              <p className={`text-xl font-bold ${budgetInfo?.color}`}>
                {Math.round((prediction.projectedMonthEnd / budget.limit) * 100)}%
              </p>
            </div>
          )}
        </div>

        {/* Budget Progress */}
        {budget && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Progress</span>
              <span className={budgetInfo?.color}>${prediction.currentSpend.toFixed(2)} / ${budget.limit}</span>
            </div>
            <Progress value={budget.percentUsed} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Projected: ${prediction.projectedMonthEnd.toFixed(2)}</span>
              <span>{budget.percentUsed.toFixed(0)}% used</span>
            </div>
          </div>
        )}

        {/* Forecast Chart */}
        {showChart && forecastData.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickFormatter={(v) => `$${v}`}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => {
                    if (value === null || value === undefined) return ['--', name]
                    return [`$${Number(value).toFixed(2)}`, name === 'actual' ? 'Actual' : name === 'projected' ? 'Projected' : name]
                  }}
                />
                {budget && (
                  <ReferenceLine 
                    y={budget.limit} 
                    stroke="hsl(var(--destructive))" 
                    strokeDasharray="5 5"
                    label={{ value: 'Budget', position: 'right', fill: 'hsl(var(--destructive))', fontSize: 10 }}
                  />
                )}
                {/* Confidence band */}
                <Area 
                  type="monotone" 
                  dataKey="upperBound" 
                  stroke="none"
                  fill="#8b5cf6"
                  fillOpacity={0.1}
                />
                <Area 
                  type="monotone" 
                  dataKey="lowerBound" 
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                />
                {/* Actual line */}
                <Area 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#actualGradient)"
                  connectNulls={false}
                />
                {/* Projected line */}
                <Line 
                  type="monotone" 
                  dataKey="projected" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        {showChart && (
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-primary" />
              <span className="text-muted-foreground">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-violet-500" style={{ borderStyle: 'dashed' }} />
              <span className="text-muted-foreground">Projected</span>
            </div>
            {budget && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-destructive" style={{ borderStyle: 'dashed' }} />
                <span className="text-muted-foreground">Budget</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
