"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  GitBranch, ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, 
  RefreshCw, Download, ChevronDown, ChevronRight, Copy, Eye,
  DollarSign, Zap, Hash, Bot
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useTrace, TraceStep, TraceDetail } from "@/hooks/api/useTraces"
import { Skeleton } from "@/components/ui/skeleton"

const statusConfig = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  running: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
}

function StepCard({ step, index, isLast }: { step: TraceStep; index: number; isLast: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()
  const config = statusConfig[step.status as keyof typeof statusConfig] || statusConfig.running
  const StatusIcon = config.icon
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    })
  }
  
  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
      )}
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex gap-4">
          {/* Timeline dot */}
          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
          </div>
          
          {/* Step content */}
          <div className="flex-1 pb-6">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {step.type}
                      </Badge>
                    </div>
                    <h4 className="font-medium mt-1">{step.name}</h4>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{step.duration}ms</p>
                    {step.tokens && (
                      <p className="text-xs text-muted-foreground">{step.tokens.total} tokens</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`${config.bg} ${config.color} ${config.border}`}>
                    {step.status}
                  </Badge>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-2 p-4 rounded-lg border bg-muted/30 space-y-4">
                {/* Timing */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-mono text-sm">{step.duration}ms</p>
                  </div>
                  {step.tokens && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Prompt Tokens</p>
                        <p className="font-mono text-sm">{step.tokens.prompt}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Completion Tokens</p>
                        <p className="font-mono text-sm">{step.tokens.completion}</p>
                      </div>
                    </>
                  )}
                  {step.cost !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Cost</p>
                      <p className="font-mono text-sm">${step.cost.toFixed(4)}</p>
                    </div>
                  )}
                </div>
                
                {/* Input */}
                {step.input && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Input</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => copyToClipboard(JSON.stringify(step.input, null, 2), 'Input')}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="p-3 rounded bg-background text-xs overflow-x-auto max-h-48 font-mono">
                      {typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Output */}
                {step.output && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Output</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => copyToClipboard(JSON.stringify(step.output, null, 2), 'Output')}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="p-3 rounded bg-background text-xs overflow-x-auto max-h-48 font-mono">
                      {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Error */}
                {step.error && (
                  <div className="p-3 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-sm font-medium text-red-500 mb-1">Error</p>
                    <pre className="text-xs text-red-400 font-mono">{step.error}</pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

export default function TraceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const traceId = params.id as string
  const { toast } = useToast()
  
  const [isExporting, setIsExporting] = useState(false)
  
  // Data fetching
  const { data: trace, isLoading, error, refetch } = useTrace(traceId)
  
  // Handlers
  const handleExport = async () => {
    if (!trace) return
    setIsExporting(true)
    try {
      const content = JSON.stringify(trace, null, 2)
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trace-${traceId}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      toast({
        title: "Export Complete",
        description: "Trace exported as JSON",
      })
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err instanceof Error ? err.message : "Failed to export trace",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }
  
  const copyTraceId = () => {
    navigator.clipboard.writeText(traceId)
    toast({
      title: "Copied",
      description: "Trace ID copied to clipboard",
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48 mt-1" />
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
  if (error || !trace) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">
              {error ? "Failed to load trace" : "Trace not found"}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button onClick={() => router.push("/traces")} variant="default">
                Back to Traces
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const config = statusConfig[trace.status as keyof typeof statusConfig] || statusConfig.running
  const StatusIcon = config.icon
  const steps: TraceStep[] = trace.steps || []
  const totalCost = steps.reduce((sum, s) => sum + (s.cost || 0), 0)
  const totalTokens = steps.reduce((sum, s) => sum + (s.tokens?.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className={`p-3 rounded-xl ${config.bg}`}>
            <GitBranch className={`h-8 w-8 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{trace.name}</h1>
              <Badge variant="outline" className={`${config.bg} ${config.color} ${config.border}`}>
                {trace.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{trace.agent}</span>
              <span>•</span>
              <button 
                onClick={copyTraceId}
                className="font-mono text-sm hover:text-foreground transition-colors"
              >
                {traceId.slice(0, 12)}...
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={handleExport} 
            className="gap-2"
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-xl font-bold capitalize">{trace.status}</p>
              </div>
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <StatusIcon className={`h-5 w-5 ${config.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-xl font-bold">{trace.duration}</p>
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
                <p className="text-sm text-muted-foreground">Steps</p>
                <p className="text-xl font-bold">{steps.length}</p>
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
                <p className="text-sm text-muted-foreground">Tokens</p>
                <p className="text-xl font-bold">{totalTokens.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Hash className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-xl font-bold">${totalCost.toFixed(4)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>
        
        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Execution Timeline</CardTitle>
              <CardDescription>Step-by-step trace of the agent execution</CardDescription>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No steps recorded for this trace</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {steps.map((step, index) => (
                    <StepCard 
                      key={step.id} 
                      step={step} 
                      index={index}
                      isLast={index === steps.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Raw Data Tab */}
        <TabsContent value="raw">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Raw Trace Data</CardTitle>
                <CardDescription>Complete JSON representation of the trace</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(trace, null, 2))
                  toast({ title: "Copied", description: "Raw trace data copied to clipboard" })
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted/50 text-sm overflow-x-auto max-h-[600px] font-mono">
                {JSON.stringify(trace, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agent Link */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Bot className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Executed by</p>
                <p className="font-medium">{trace.agent}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => router.push(`/agents/${trace.agentId || trace.agent}`)}
            >
              <Eye className="h-4 w-4" />
              View Agent
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
