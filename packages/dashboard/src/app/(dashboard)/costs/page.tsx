"use client"

import { useState } from "react"
import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, CreditCard, Coins, PieChart, ChevronDown, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

const timeRanges = [
  { id: "today", label: "Today", shortLabel: "Today" },
  { id: "week", label: "This Week", shortLabel: "This Week" },
  { id: "month", label: "This Month", shortLabel: "This Month" },
  { id: "quarter", label: "This Quarter", shortLabel: "Quarter" },
  { id: "year", label: "This Year", shortLabel: "Year" },
]

const mockUsageByModel = [
  { model: "GPT-4", usage: 45, cost: "$234.50", tokens: "1.2M", color: "bg-violet-500" },
  { model: "Claude 3", usage: 30, cost: "$156.20", tokens: "890K", color: "bg-blue-500" },
  { model: "GPT-3.5", usage: 15, cost: "$23.40", tokens: "2.1M", color: "bg-emerald-500" },
  { model: "Others", usage: 10, cost: "$12.80", tokens: "450K", color: "bg-amber-500" },
]

const mockDailyCosts = [
  { date: "Today", cost: "$45.20", tokens: "125K", change: "+12%" },
  { date: "Yesterday", cost: "$40.30", tokens: "112K", change: "-5%" },
  { date: "Jan 17", cost: "$42.50", tokens: "118K", change: "+8%" },
  { date: "Jan 16", cost: "$39.20", tokens: "109K", change: "-3%" },
  { date: "Jan 15", cost: "$40.50", tokens: "113K", change: "+15%" },
]

export default function CostsPage() {
  const { toast } = useToast()
  const [selectedRange, setSelectedRange] = useState("month")

  const handleRangeChange = (rangeId: string) => {
    setSelectedRange(rangeId)
    const range = timeRanges.find(r => r.id === rangeId)
    toast({
      title: "Time Range Updated",
      description: `Now showing data for: ${range?.label}`,
    })
  }

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your cost report is being generated...",
    })
    
    setTimeout(() => {
      const csvContent = `Cost Report - ${timeRanges.find(r => r.id === selectedRange)?.label}\n\nModel Usage:\n` +
        "model,usage_percent,cost,tokens\n" +
        mockUsageByModel.map(m => `${m.model},${m.usage}%,${m.cost},${m.tokens}`).join("\n") +
        "\n\nDaily Breakdown:\n" +
        "date,cost,tokens,change\n" +
        mockDailyCosts.map(d => `${d.date},${d.cost},${d.tokens},${d.change}`).join("\n")
      
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cost-report-${selectedRange}-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast({
        title: "Export Complete",
        description: "Your cost report has been downloaded.",
      })
    }, 1000)
  }

  const selectedRangeLabel = timeRanges.find(r => r.id === selectedRange)?.shortLabel || "This Month"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10">
            <DollarSign className="h-6 w-6 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Costs</h1>
            <p className="text-muted-foreground">Track API usage and cost analytics</p>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {selectedRangeLabel}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {timeRanges.map((range) => (
                <DropdownMenuItem 
                  key={range.id}
                  onClick={() => handleRangeChange(range.id)}
                  className="flex items-center justify-between"
                >
                  {range.label}
                  {selectedRange === range.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Spend (MTD)</p>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">$426.90</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-emerald-500">+12.5% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Tokens Used</p>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">4.64M</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-emerald-500">+8.2% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Avg. Daily Cost</p>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">$22.47</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-xs text-red-500">-3.1% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Budget Remaining</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">$573.10</p>
            <Progress value={43} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">43% of $1,000 budget used</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage by Model */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
            <CardDescription>Token consumption and costs by AI model</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockUsageByModel.map((item) => (
                <div key={item.model} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="font-medium text-foreground">{item.model}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{item.tokens}</span>
                      <span className="text-sm font-medium text-foreground w-20 text-right">{item.cost}</span>
                    </div>
                  </div>
                  <Progress value={item.usage} className="h-2" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-bold text-foreground">$426.90</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
            <CardDescription>Recent daily cost and token usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockDailyCosts.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{day.date}</p>
                      <p className="text-sm text-muted-foreground">{day.tokens} tokens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant="outline" 
                      className={day.change.startsWith('+') 
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                      }
                    >
                      {day.change}
                    </Badge>
                    <span className="font-medium text-foreground w-16 text-right">{day.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Optimization Tips</CardTitle>
          <CardDescription>Recommendations to reduce your AI operations costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded bg-emerald-500/10">
                  <TrendingDown className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="font-medium text-foreground">Use GPT-3.5 for simple tasks</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirect simpler queries to GPT-3.5 Turbo to save up to 90% on token costs.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded bg-blue-500/10">
                  <Coins className="h-4 w-4 text-blue-500" />
                </div>
                <h3 className="font-medium text-foreground">Enable response caching</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Cache common responses to reduce duplicate API calls by up to 40%.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded bg-violet-500/10">
                  <PieChart className="h-4 w-4 text-violet-500" />
                </div>
                <h3 className="font-medium text-foreground">Optimize prompt length</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Review and shorten system prompts to reduce input token consumption.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
