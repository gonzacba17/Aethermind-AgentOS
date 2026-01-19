"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  Bot, ArrowLeft, Activity, Clock, Zap, DollarSign, MoreVertical, 
  Settings, Trash2, Pause, Play, Eye, FileText, RefreshCw, Loader2,
  TrendingUp, TrendingDown, Calendar, Hash
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useAgent, useDeleteAgent, useTraces, useLogs } from "@/hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

const statusColors = {
  running: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  idle: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  timeout: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

export default function AgentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agentId = params.id as string
  const { toast } = useToast()
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Data fetching
  const { data: agent, isLoading, error, refetch } = useAgent(agentId)
  const { data: tracesData } = useTraces({ agentId, limit: 5 })
  const { data: logsData } = useLogs({ agentId, limit: 10 })
  const deleteAgent = useDeleteAgent()
  
  const recentTraces = tracesData?.data || []
  const recentLogs = logsData?.logs || []
  
  // Handlers
  const handleDelete = async () => {
    try {
      await deleteAgent.mutateAsync(agentId)
      setIsDeleteDialogOpen(false)
      toast({
        title: "Agent Deleted",
        description: "The agent has been deleted successfully.",
      })
      router.push("/agents")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete agent",
        variant: "destructive",
      })
    }
  }
  
  const handleViewAllTraces = () => {
    router.push(`/traces?agentId=${agentId}`)
  }
  
  const handleViewAllLogs = () => {
    router.push(`/logs?agentId=${agentId}`)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
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
  if (error || !agent) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">
              {error ? "Failed to load agent" : "Agent not found"}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button onClick={() => router.push("/agents")} variant="default">
                Back to Agents
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/20">
            <Bot className="h-8 w-8 text-violet-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
              <Badge 
                variant="outline" 
                className={statusColors[agent.status as keyof typeof statusColors] || statusColors.idle}
              >
                {agent.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {agent.model} • ID: {agent.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "Edit functionality will be available soon" })}>
                <Settings className="h-4 w-4 mr-2" />
                Edit Configuration
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "This action will be available soon" })}>
                {agent.status === "running" ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause Agent
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Agent
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-500 focus:text-red-500"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-xl font-bold capitalize">{agent.status}</p>
              </div>
              <div className={`p-2 rounded-lg ${agent.status === 'running' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <Activity className={`h-5 w-5 ${agent.status === 'running' ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="text-xl font-bold">{agent.model}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Max Tokens</p>
                <p className="text-xl font-bold">{agent.config?.maxTokens?.toLocaleString() || 'N/A'}</p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Hash className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temperature</p>
                <p className="text-xl font-bold">{agent.config?.temperature || 0.7}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traces">Recent Traces</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Prompt */}
            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>The agent's behavior instructions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-muted/50 font-mono text-sm whitespace-pre-wrap">
                  {agent.config?.systemPrompt || "No system prompt configured"}
                </div>
              </CardContent>
            </Card>
            
            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest traces from this agent</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={handleViewAllTraces}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                {recentTraces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTraces.map(trace => (
                      <div 
                        key={trace.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/traces/${trace.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">{trace.name}</p>
                          <p className="text-xs text-muted-foreground">{trace.timestamp}</p>
                        </div>
                        <Badge variant="outline" className={
                          trace.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                          trace.status === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500'
                        }>
                          {trace.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Traces Tab */}
        <TabsContent value="traces">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Execution Traces</CardTitle>
                <CardDescription>All traces for this agent</CardDescription>
              </div>
              <Button onClick={handleViewAllTraces} className="gap-2">
                <Eye className="h-4 w-4" />
                View All in Traces
              </Button>
            </CardHeader>
            <CardContent>
              {recentTraces.length === 0 ? (
                <EmptyState
                  preset="traces"
                  description="This agent hasn't executed any tasks yet"
                />
              ) : (
                <div className="space-y-3">
                  {recentTraces.map(trace => (
                    <div 
                      key={trace.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/traces/${trace.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          trace.status === 'success' ? 'bg-emerald-500/10' :
                          trace.status === 'error' ? 'bg-red-500/10' :
                          'bg-blue-500/10'
                        }`}>
                          <Activity className={`h-5 w-5 ${
                            trace.status === 'success' ? 'text-emerald-500' :
                            trace.status === 'error' ? 'text-red-500' :
                            'text-blue-500'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{trace.name}</p>
                          <p className="text-sm text-muted-foreground">{trace.timestamp}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{trace.duration}</p>
                          <p className="text-xs text-muted-foreground">{trace.steps} steps</p>
                        </div>
                        <Badge variant="outline" className={
                          trace.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                          trace.status === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500'
                        }>
                          {trace.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Agent Logs</CardTitle>
                <CardDescription>Recent log entries from this agent</CardDescription>
              </div>
              <Button onClick={handleViewAllLogs} className="gap-2">
                <FileText className="h-4 w-4" />
                View All Logs
              </Button>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <EmptyState
                  preset="logs"
                  description="No logs available for this agent"
                />
              ) : (
                <div className="space-y-1 font-mono text-sm max-h-[400px] overflow-y-auto">
                  {recentLogs.map((log: any, index: number) => (
                    <div
                      key={log.id || index}
                      className={`flex items-start gap-3 p-2 rounded ${
                        log.level === 'error' ? 'bg-red-500/5' :
                        log.level === 'warn' ? 'bg-amber-500/5' :
                        'hover:bg-muted/30'
                      }`}
                    >
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${
                          log.level === 'error' ? 'bg-red-500/10 text-red-500' :
                          log.level === 'warn' ? 'bg-amber-500/10 text-amber-500' :
                          log.level === 'info' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {log.level?.toUpperCase()}
                      </Badge>
                      <span className="text-foreground/90 break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Configuration Tab */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>Current settings for this agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Agent ID</p>
                    <p className="font-mono text-sm">{agent.id}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{agent.model}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Max Tokens</p>
                    <p className="font-medium">{agent.config?.maxTokens || 'Default'}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Temperature</p>
                    <p className="font-medium">{agent.config?.temperature || 0.7}</p>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-2">System Prompt</p>
                  <pre className="text-sm whitespace-pre-wrap font-mono bg-background/50 p-3 rounded">
                    {agent.config?.systemPrompt || "No system prompt configured"}
                  </pre>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => toast({ title: "Coming Soon", description: "Edit functionality will be available soon" })}
                  >
                    <Settings className="h-4 w-4" />
                    Edit Configuration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agent.name}"? This action cannot be undone.
              All associated traces and logs will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
