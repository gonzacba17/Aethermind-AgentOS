"use client"

import { useState } from "react"
import { TrendingUp, AlertTriangle, BarChart3, Bell, RefreshCw, Check, Loader2, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  useForecast,
  usePatterns,
  useAnomalies,
  useForecastingAlerts,
  useSeasonalPatterns,
  useAcknowledgeAlert,
} from "@/hooks/api/useForecasting"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

export default function ForecastingPage() {
  const { toast } = useToast()

  // State
  const [horizonDays, setHorizonDays] = useState(7)
  const [patternDays, setPatternDays] = useState(30)

  // API hooks
  const { data: forecast, isLoading: forecastLoading, refetch: refetchForecast } = useForecast(horizonDays)
  const { data: patterns, isLoading: patternsLoading } = usePatterns(patternDays)
  const { data: anomaliesData, isLoading: anomaliesLoading } = useAnomalies(7)
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useForecastingAlerts()
  const { data: seasonal, isLoading: seasonalLoading } = useSeasonalPatterns(30)
  const acknowledgeAlert = useAcknowledgeAlert()

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert.mutateAsync({ alertId })
      toast({ title: "Alert Acknowledged", description: "The alert has been marked as acknowledged." })
    } catch (error) {
      toast({ title: "Error", description: "Failed to acknowledge alert", variant: "destructive" })
    }
  }

  const chartData = forecast?.periods.map(p => ({
    date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: p.predicted_cost,
    lower: p.confidence_interval[0],
    upper: p.confidence_interval[1],
    trend: p.trend,
  })) || []

  const hourlyData = seasonal?.hourly.map((value, i) => ({
    hour: seasonal.labels.hourly[i],
    usage: value,
  })) || []

  const dailyData = seasonal?.daily.map((value, i) => ({
    day: seasonal.labels.daily[i].slice(0, 3),
    usage: value,
  })) || []

  const severityColors = {
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    high: 'bg-red-500/10 text-red-500 border-red-500/20',
    critical: 'bg-red-600/10 text-red-600 border-red-600/20',
  }

  const isLoading = forecastLoading || patternsLoading || anomaliesLoading || alertsLoading

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const unacknowledgedAlerts = alertsData?.alerts.filter(a => !a.acknowledged) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <TrendingUp className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Forecasting</h1>
            <p className="text-muted-foreground">Predictive analytics and cost forecasting</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { refetchForecast(); refetchAlerts(); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projected Cost ({horizonDays}d)</p>
                <p className="text-2xl font-bold text-foreground">
                  ${forecast?.summary.totalProjectedCost.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <TrendingUp className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Daily Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  ${forecast?.summary.averageDailyCost.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Anomalies Detected</p>
                <p className="text-2xl font-bold text-foreground">{anomaliesData?.count || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-foreground">{unacknowledgedAlerts.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <Bell className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="forecast" className="space-y-6">
        <TabsList>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
                {unacknowledgedAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cost Forecast</CardTitle>
                  <CardDescription>Predicted costs for the next {horizonDays} days</CardDescription>
                </div>
                <Select value={horizonDays.toString()} onValueChange={(v) => setHorizonDays(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v.toFixed(0)}`} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'cost') return [`$${value.toFixed(2)}`, 'Predicted'];
                        return [`$${value.toFixed(2)}`, name];
                      }}
                    />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--muted))" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="hsl(var(--muted))" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#costGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Hourly Usage Pattern</CardTitle>
                <CardDescription>Average usage by hour of day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} interval={2} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage Pattern</CardTitle>
                <CardDescription>Average usage by day of week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="usage" radius={[4, 4, 0, 0]}>
                        {dailyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 1 || index === 2 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          {patterns && (
            <Card>
              <CardHeader>
                <CardTitle>Trend Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-lg font-bold capitalize">{patterns.costTrend.direction}</p>
                    <p className="text-sm text-muted-foreground">Cost Trend</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-lg font-bold">{(patterns.costTrend.strength * 100).toFixed(0)}%</p>
                    <p className="text-sm text-muted-foreground">Trend Strength</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-lg font-bold">${patterns.statistics.mean.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Average Cost</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-lg font-bold">{patterns.dataPoints.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Data Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detected Anomalies</CardTitle>
              <CardDescription>Unusual patterns in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {anomaliesData?.anomalies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No anomalies detected</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomaliesData?.anomalies.map((anomaly, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                      <div className={`p-2 rounded-lg ${severityColors[anomaly.severity].split(' ')[0]}`}>
                        <AlertTriangle className={`h-5 w-5 ${severityColors[anomaly.severity].split(' ')[1]}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{anomaly.reason}</span>
                          <Badge variant="outline" className={severityColors[anomaly.severity]}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Value: ${anomaly.value.toFixed(2)} (expected: ${anomaly.expectedRange[0].toFixed(2)} - ${anomaly.expectedRange[1].toFixed(2)})
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(anomaly.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Predictive Alerts</CardTitle>
              <CardDescription>AI-generated alerts based on forecasting analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsData?.alerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertsData?.alerts.map((alert) => (
                    <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-lg border ${alert.acknowledged ? 'bg-muted/30' : 'bg-card'}`}>
                      <div className={`p-2 rounded-lg ${severityColors[alert.priority].split(' ')[0]}`}>
                        <Bell className={`h-5 w-5 ${severityColors[alert.priority].split(' ')[1]}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{alert.message}</span>
                          <Badge variant="outline" className={severityColors[alert.priority]}>
                            {alert.priority}
                          </Badge>
                          {alert.acknowledged && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              <Check className="h-3 w-3 mr-1" />
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.type} - {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledgeAlert.isPending}
                        >
                          {acknowledgeAlert.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      )}
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
