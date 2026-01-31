"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, GitBranch, Play, DollarSign, Trash2, Loader2, RefreshCw, ArrowRight, Circle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useWorkflow, useDeleteWorkflow, useEstimateWorkflow, useExecuteWorkflow } from "@/hooks/api/useWorkflows"

interface WorkflowDetailPageProps {
  params: Promise<{ name: string }>
}

export default function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { name } = use(params)
  const decodedName = decodeURIComponent(name)
  const router = useRouter()
  const { toast } = useToast()

  const { data: workflow, isLoading, error, refetch } = useWorkflow(decodedName)
  const deleteWorkflow = useDeleteWorkflow()
  const estimateWorkflow = useEstimateWorkflow()
  const executeWorkflow = useExecuteWorkflow()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isExecuteOpen, setIsExecuteOpen] = useState(false)
  const [executeInput, setExecuteInput] = useState('{}')
  const [estimate, setEstimate] = useState<any>(null)
  const [executionResult, setExecutionResult] = useState<any>(null)

  const handleDelete = async () => {
    try {
      await deleteWorkflow.mutateAsync(decodedName)
      toast({ title: "Workflow Deleted", description: "The workflow has been deleted successfully." })
      router.push('/workflows')
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete workflow", variant: "destructive" })
    }
  }

  const handleEstimate = async () => {
    try {
      const result = await estimateWorkflow.mutateAsync({ name: decodedName })
      setEstimate(result)
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to estimate cost", variant: "destructive" })
    }
  }

  const handleExecute = async () => {
    let input: any
    try {
      input = JSON.parse(executeInput)
    } catch (e) {
      toast({ title: "Validation Error", description: "Invalid input JSON format", variant: "destructive" })
      return
    }

    try {
      const result = await executeWorkflow.mutateAsync({ name: decodedName, input })
      setExecutionResult(result)
      toast({ title: "Workflow Executed", description: `Execution completed in ${result.duration}ms` })
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to execute workflow", variant: "destructive" })
    }
  }

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
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/workflows')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Workflows
        </Button>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Workflow not found or failed to load</div>
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workflows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <GitBranch className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{workflow.name}</h1>
            {workflow.description && (
              <p className="text-muted-foreground">{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleEstimate} disabled={estimateWorkflow.isPending} className="gap-2">
            {estimateWorkflow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Estimate
          </Button>
          <Button onClick={() => setIsExecuteOpen(true)} className="gap-2">
            <Play className="h-4 w-4" />
            Execute
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Cost Estimate */}
      {estimate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">${estimate.estimatedCost.toFixed(4)}</p>
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{estimate.tokenCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Tokens</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{(estimate.confidence * 100).toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Confidence</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{Object.keys(estimate.breakdown || {}).length}</p>
                <p className="text-sm text-muted-foreground">Steps Estimated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps</CardTitle>
          <CardDescription>
            {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''} starting from {workflow.entryPoint}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflow.steps.map((step, index) => {
              const isEntry = step.id === workflow.entryPoint
              const nextSteps = Array.isArray(step.next) ? step.next : step.next ? [step.next] : []

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${isEntry ? 'border-blue-500/50 bg-blue-500/5' : 'bg-card'}`}
                >
                  <div className={`p-2 rounded-lg ${isEntry ? 'bg-blue-500/20' : 'bg-muted'}`}>
                    <Circle className={`h-5 w-5 ${isEntry ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{step.id}</h3>
                      {isEntry && <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Entry</Badge>}
                      {step.parallel && <Badge variant="outline">Parallel</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Agent: {step.agent}</p>
                    {step.condition && (
                      <p className="text-xs text-muted-foreground mt-1">Condition: {step.condition}</p>
                    )}
                  </div>
                  {nextSteps.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="h-4 w-4" />
                      <span>{nextSteps.join(', ')}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Execution Result */}
      {executionResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Last Execution Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Badge variant={executionResult.status === 'completed' ? 'default' : 'destructive'}>
                    {executionResult.status}
                  </Badge>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-lg font-bold">{executionResult.duration}ms</p>
                  <p className="text-sm text-muted-foreground">Duration</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center col-span-2">
                  <p className="text-sm font-mono truncate">{executionResult.executionId}</p>
                  <p className="text-sm text-muted-foreground">Execution ID</p>
                </div>
              </div>
              {executionResult.output && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium mb-2">Output:</p>
                  <pre className="text-xs font-mono overflow-auto max-h-32">
                    {JSON.stringify(executionResult.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execute Dialog */}
      <Dialog open={isExecuteOpen} onOpenChange={setIsExecuteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Workflow</DialogTitle>
            <DialogDescription>
              Run {workflow.name} with input data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="input">Input (JSON)</Label>
              <Textarea
                id="input"
                className="h-32 font-mono text-sm"
                placeholder='{ "key": "value" }'
                value={executeInput}
                onChange={(e) => setExecuteInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExecuteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecute} disabled={executeWorkflow.isPending}>
              {executeWorkflow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workflow.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteWorkflow.isPending}
            >
              {deleteWorkflow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
