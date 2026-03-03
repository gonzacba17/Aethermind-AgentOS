"use client"

import { useState, useMemo, useCallback, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { FileText, Search, Filter, Download, X, RefreshCw, Loader2, Pause, Play, Circle, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useLogs, useLogStats, exportLogs, useWebSocket, EnhancedLogEntry } from "@/hooks"
import { ConnectionStatus } from "@/components/ui/connection-status"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

const levelConfig = {
  debug: { icon: Bug, color: "text-muted-foreground", bg: "bg-muted", label: "DEBUG" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", label: "INFO" },
  warn: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", label: "WARN" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", label: "WARN" },
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", label: "ERROR" },
}

function LogsPageContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const logsContainerRef = useRef<HTMLDivElement>(null)
  
  // Get initial values from URL params
  const initialSearch = searchParams.get('search') || ""
  const initialAgentId = searchParams.get('agentId') || ""
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [levelFilters, setLevelFilters] = useState<string[]>([])
  const [agentIdFilter, setAgentIdFilter] = useState(initialAgentId)
  const [isPaused, setIsPaused] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  
  // Live logs buffer (from WebSocket)
  const [liveLogs, setLiveLogs] = useState<EnhancedLogEntry[]>([])
  
  // Data fetching
  const { data, isLoading, error, refetch } = useLogs({
    level: levelFilters.length > 0 ? levelFilters : undefined,
    agentId: agentIdFilter || undefined,
    search: searchQuery || undefined,
    limit: 200,
  })
  const { data: stats } = useLogStats()
  const { lastEvent, isConnected } = useWebSocket()
  
  // Handle live log events
  useEffect(() => {
    if (lastEvent?.type === 'log' && !isPaused && lastEvent.data) {
      const newLog = lastEvent.data as EnhancedLogEntry
      setLiveLogs(prev => [newLog, ...prev].slice(0, 100)) // Keep max 100 live logs
    }
  }, [lastEvent, isPaused])
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current && liveLogs.length > 0) {
      logsContainerRef.current.scrollTop = 0
    }
  }, [liveLogs, autoScroll])
  
  // Combine live logs with API logs
  const allLogs = useMemo(() => {
    const apiLogs = data?.logs || []
    if (isPaused) return apiLogs
    
    // Merge and dedupe by id, live logs first
    const liveIds = new Set(liveLogs.map(l => l.id))
    const uniqueApiLogs = apiLogs.filter((l: EnhancedLogEntry) => !liveIds.has(l.id))
    return [...liveLogs, ...uniqueApiLogs]
  }, [data?.logs, liveLogs, isPaused])
  
  // Client-side filtering
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log: EnhancedLogEntry) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesMessage = log.message.toLowerCase().includes(query)
        const matchesAgent = log.agentId?.toLowerCase().includes(query)
        if (!matchesMessage && !matchesAgent) return false
      }
      
      // Level filter (already applied by API, but filter live logs too)
      if (levelFilters.length > 0 && !levelFilters.includes(log.level)) {
        return false
      }
      
      // Agent filter
      if (agentIdFilter && log.agentId !== agentIdFilter) {
        return false
      }
      
      return true
    })
  }, [allLogs, searchQuery, levelFilters, agentIdFilter])
  
  // Filter helpers
  const toggleLevelFilter = useCallback((level: string) => {
    setLevelFilters(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setLevelFilters([])
    setSearchQuery("")
    setAgentIdFilter("")
  }, [])

  const hasActiveFilters = levelFilters.length > 0 || searchQuery || agentIdFilter
  
  // Handlers
  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true)
    try {
      await exportLogs(filteredLogs, format)
      toast({
        title: "Export Complete",
        description: `${filteredLogs.length} logs exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export logs",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }
  
  const handleClearLogs = () => {
    setLiveLogs([])
    toast({
      title: "Live Logs Cleared",
      description: "Live log buffer has been cleared",
    })
  }
  
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3,
      })
    } catch {
      return timestamp
    }
  }

  // Loading state
  if (isLoading) {
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <FileText className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logs</h1>
            <p className="text-muted-foreground">View system and agent logs</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load logs</div>
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
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <FileText className="h-6 w-6 text-amber-500" />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Logs</h1>
              <p className="text-muted-foreground">View system and agent logs</p>
            </div>
            <ConnectionStatus showLabel />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={isExporting || filteredLogs.length === 0}>
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
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-500">{stats?.info || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-amber-500">{stats?.warn || 0}</p>
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
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-500">{stats?.error || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-500" />
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
            placeholder="Search logs..." 
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
              Level
              {levelFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {levelFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem 
              checked={levelFilters.includes("debug")}
              onCheckedChange={() => toggleLevelFilter("debug")}
            >
              <span className="flex items-center gap-2">
                <Circle className="h-2 w-2 text-muted-foreground fill-muted-foreground" />
                Debug
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={levelFilters.includes("info")}
              onCheckedChange={() => toggleLevelFilter("info")}
            >
              <span className="flex items-center gap-2">
                <Circle className="h-2 w-2 text-blue-500 fill-blue-500" />
                Info
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={levelFilters.includes("warn")}
              onCheckedChange={() => toggleLevelFilter("warn")}
            >
              <span className="flex items-center gap-2">
                <Circle className="h-2 w-2 text-amber-500 fill-amber-500" />
                Warning
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={levelFilters.includes("error")}
              onCheckedChange={() => toggleLevelFilter("error")}
            >
              <span className="flex items-center gap-2">
                <Circle className="h-2 w-2 text-red-500 fill-red-500" />
                Error
              </span>
            </DropdownMenuCheckboxItem>
            {levelFilters.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLevelFilters([])} className="text-muted-foreground">
                  Clear level filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Logs List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Log Stream
                {!isPaused && liveLogs.length > 0 && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    Live
                  </Badge>
                )}
                {isPaused && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                    Paused
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} logs
                {liveLogs.length > 0 && ` (${liveLogs.length} live)`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearLogs}>
              Clear Live
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <EmptyState
              preset="logs"
              actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          ) : (
            <div 
              ref={logsContainerRef}
              className="space-y-1 font-mono text-sm max-h-[500px] overflow-y-auto"
            >
              {filteredLogs.map((log: EnhancedLogEntry, index: number) => {
                const config = levelConfig[log.level as keyof typeof levelConfig] || levelConfig.info
                const LevelIcon = config.icon
                
                return (
                  <div
                    key={log.id || `log-${index}`}
                    className={`flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors ${
                      liveLogs.some(l => l.id === log.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="text-xs text-muted-foreground shrink-0 w-24">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`${config.bg} ${config.color} text-[10px] px-1.5 py-0 shrink-0 w-14 justify-center`}
                    >
                      {config.label}
                    </Badge>
                    {log.source && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {log.source}
                      </Badge>
                    )}
                    <span className="text-foreground/90 flex-1 break-all">
                      {log.message}
                    </span>
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

// Wrapper component with Suspense boundary for useSearchParams
export default function LogsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <Skeleton className="h-64" />
      </div>
    }>
      <LogsPageContent />
    </Suspense>
  )
}
