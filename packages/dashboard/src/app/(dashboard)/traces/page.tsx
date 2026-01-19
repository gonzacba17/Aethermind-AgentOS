"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle, Download, X, RefreshCw, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useTraces, useTraceStats, exportTraces, TraceListItem } from "@/hooks"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

const statusConfig = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  running: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
}

export default function TracesPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [agentFilters, setAgentFilters] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  
  // Data fetching
  const { data, isLoading, error, refetch } = useTraces({
    status: statusFilters,
    agentId: agentFilters[0], // API might only support single agent filter
  })
  const { data: stats } = useTraceStats()
  
  const traces = data?.data || []
  const totalTraces = data?.total || traces.length
  
  // Compute unique agents for filter dropdown
  const uniqueAgents = useMemo(() => {
    const agents = new Set(traces.map(t => t.agent))
    return Array.from(agents).filter(Boolean)
  }, [traces])
  
  // Client-side filtering for search (API might not support it)
  const filteredTraces = useMemo(() => {
    if (!searchQuery) return traces
    const query = searchQuery.toLowerCase()
    return traces.filter(trace => 
      trace.name.toLowerCase().includes(query) ||
      trace.agent.toLowerCase().includes(query) ||
      trace.id.toLowerCase().includes(query)
    )
  }, [traces, searchQuery])
  
  // Filter helpers
  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }, [])

  const toggleAgentFilter = useCallback((agent: string) => {
    setAgentFilters(prev => 
      prev.includes(agent) 
        ? prev.filter(a => a !== agent)
        : [...prev, agent]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setStatusFilters([])
    setAgentFilters([])
    setSearchQuery("")
  }, [])

  const hasActiveFilters = statusFilters.length > 0 || agentFilters.length > 0
  
  // Handlers
  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true)
    try {
      await exportTraces(filteredTraces, format)
      toast({
        title: "Export Complete",
        description: `Traces exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export traces",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }
  
  const handleTraceClick = (trace: TraceListItem) => {
    // Navigate to trace detail page (will be created)
    router.push(`/traces/${trace.id}`)
  }

  // Loading state
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
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <GitBranch className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Traces</h1>
            <p className="text-muted-foreground">Monitor agent execution traces</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load traces</div>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <GitBranch className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Traces</h1>
            <p className="text-muted-foreground">Monitor agent execution traces</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={isExporting || filteredTraces.length === 0}>
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
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total (24h)</p>
                <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <GitBranch className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-emerald-500">{stats?.success || 0}</p>
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
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold text-blue-500">{stats?.running || 0}</p>
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
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{stats?.error || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search traces..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {statusFilters.length + agentFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuCheckboxItem 
              checked={statusFilters.includes("success")}
              onCheckedChange={() => toggleStatusFilter("success")}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Success
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={statusFilters.includes("running")}
              onCheckedChange={() => toggleStatusFilter("running")}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Running
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={statusFilters.includes("error")}
              onCheckedChange={() => toggleStatusFilter("error")}
            >
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Error
              </span>
            </DropdownMenuCheckboxItem>
            {uniqueAgents.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Agent</DropdownMenuLabel>
                {uniqueAgents.map(agent => (
                  <DropdownMenuCheckboxItem 
                    key={agent}
                    checked={agentFilters.includes(agent)}
                    onCheckedChange={() => toggleAgentFilter(agent)}
                  >
                    {agent}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-muted-foreground">
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Traces List */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Traces</CardTitle>
          <CardDescription>
            {filteredTraces.length === totalTraces 
              ? `${totalTraces} trace${totalTraces !== 1 ? 's' : ''} in the last 24 hours`
              : `Showing ${filteredTraces.length} of ${totalTraces} traces`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTraces.length === 0 ? (
            <EmptyState
              preset="traces"
              actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filteredTraces.map((trace) => {
                const config = statusConfig[trace.status as keyof typeof statusConfig] || statusConfig.running
                const StatusIcon = config.icon
                
                return (
                  <div
                    key={trace.id}
                    onClick={() => handleTraceClick(trace)}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <StatusIcon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{trace.name}</h3>
                          <Badge variant="outline" className={`${config.bg} ${config.color} ${config.border}`}>
                            {trace.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {trace.agent} • {trace.timestamp}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">{trace.duration}</p>
                        <p className="text-xs text-muted-foreground">Duration</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">{trace.steps}</p>
                        <p className="text-xs text-muted-foreground">Steps</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
