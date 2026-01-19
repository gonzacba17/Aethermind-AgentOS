"use client"

import { GitBranch, Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const mockTraces = [
  {
    id: "trace-001",
    name: "Customer inquiry processing",
    agent: "Customer Support Agent",
    status: "success",
    duration: "1.2s",
    timestamp: "2 min ago",
    steps: 5,
  },
  {
    id: "trace-002",
    name: "Data extraction pipeline",
    agent: "Data Analysis Agent",
    status: "success",
    duration: "3.4s",
    timestamp: "5 min ago",
    steps: 8,
  },
  {
    id: "trace-003",
    name: "Content generation task",
    agent: "Content Writer Agent",
    status: "running",
    duration: "ongoing",
    timestamp: "1 min ago",
    steps: 3,
  },
  {
    id: "trace-004",
    name: "Code review analysis",
    agent: "Code Review Agent",
    status: "error",
    duration: "2.1s",
    timestamp: "10 min ago",
    steps: 4,
  },
  {
    id: "trace-005",
    name: "Report compilation",
    agent: "Data Analysis Agent",
    status: "success",
    duration: "5.2s",
    timestamp: "15 min ago",
    steps: 12,
  },
]

const statusConfig = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  running: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
}

export default function TracesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <GitBranch className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Traces</h1>
            <p className="text-muted-foreground">Analyze agent execution traces and workflows</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export Traces</Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search traces..." 
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Traces</p>
                <p className="text-2xl font-bold text-foreground">12,847</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-emerald-500">98.5%</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold text-foreground">2.3s</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold text-red-500">1.5%</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traces List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Traces</CardTitle>
          <CardDescription>View detailed execution traces from your agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockTraces.map((trace) => {
              const config = statusConfig[trace.status as keyof typeof statusConfig]
              const StatusIcon = config.icon
              
              return (
                <div
                  key={trace.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{trace.name}</h3>
                        <Badge variant="outline" className={`${config.bg} ${config.color} ${config.border}`}>
                          {trace.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trace.agent} • {trace.steps} steps • {trace.timestamp}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-foreground">{trace.duration}</p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
