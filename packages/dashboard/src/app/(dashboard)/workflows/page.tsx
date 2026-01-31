"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Plus, Search, MoreVertical, Play, DollarSign, Trash2, Eye, Loader2, RefreshCw, X, Clock, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/hooks/use-toast"
import { useWorkflows, useCreateWorkflow, useDeleteWorkflow, useEstimateWorkflow, useExecuteWorkflow, type Workflow, type CreateWorkflowData, type WorkflowStep } from "@/hooks/api/useWorkflows"

interface WorkflowFormData {
  name: string;
  description: string;
  stepsJson: string;
  entryPoint: string;
}

const defaultFormData: WorkflowFormData = {
  name: '',
  description: '',
  stepsJson: JSON.stringify([
    { id: 'step-1', agent: 'my-agent', next: 'step-2' },
    { id: 'step-2', agent: 'another-agent' }
  ], null, 2),
  entryPoint: 'step-1',
}

export default function WorkflowsPage() {
  const router = useRouter()
  const { toast } = useToast()

  // API hooks
  const { data, isLoading, error, refetch } = useWorkflows()
  const createWorkflow = useCreateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const estimateWorkflow = useEstimateWorkflow()
  const executeWorkflow = useExecuteWorkflow()

  const workflows = data?.data || []

  // UI State
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isEstimateOpen, setIsEstimateOpen] = useState(false)
  const [isExecuteOpen, setIsExecuteOpen] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [executeInput, setExecuteInput] = useState('{}')
  const [estimate, setEstimate] = useState<any>(null)
  const [formData, setFormData] = useState<WorkflowFormData>(defaultFormData)

  // Filtered workflows
  const filteredWorkflows = searchQuery
    ? workflows.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : workflows

  // Stats
  const totalWorkflows = workflows.length

  // Handlers
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Workflow name is required", variant: "destructive" })
      return
    }

    let steps: WorkflowStep[]
    try {
      steps = JSON.parse(formData.stepsJson)
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('Steps must be a non-empty array')
      }
    } catch (e) {
      toast({ title: "Validation Error", description: "Invalid steps JSON format", variant: "destructive" })
      return
    }

    if (!steps.find(s => s.id === formData.entryPoint)) {
      toast({ title: "Validation Error", description: "Entry point must match a step ID", variant: "destructive" })
      return
    }

    try {
      await createWorkflow.mutateAsync({
        name: formData.name,
        description: formData.description,
        steps,
        entryPoint: formData.entryPoint,
      })

      setIsCreateOpen(false)
      setFormData(defaultFormData)
      toast({ title: "Workflow Created", description: `${formData.name} has been created successfully.` })
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create workflow", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!workflowToDelete) return

    try {
      await deleteWorkflow.mutateAsync(workflowToDelete.name)
      setIsDeleteOpen(false)
      setWorkflowToDelete(null)
      toast({ title: "Workflow Deleted", description: `${workflowToDelete.name} has been deleted.` })
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete workflow", variant: "destructive" })
    }
  }

  const handleEstimate = async (workflow: Workflow) => {
    setSelectedWorkflow(workflow)
    setEstimate(null)
    setIsEstimateOpen(true)

    try {
      const result = await estimateWorkflow.mutateAsync({ name: workflow.name })
      setEstimate(result)
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to estimate cost", variant: "destructive" })
    }
  }

  const handleExecute = async () => {
    if (!selectedWorkflow) return

    let input: any
    try {
      input = JSON.parse(executeInput)
    } catch (e) {
      toast({ title: "Validation Error", description: "Invalid input JSON format", variant: "destructive" })
      return
    }

    try {
      const result = await executeWorkflow.mutateAsync({ name: selectedWorkflow.name, input })
      setIsExecuteOpen(false)
      toast({
        title: "Workflow Executed",
        description: `Execution ${result.executionId} completed in ${result.duration}ms`,
      })
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to execute workflow", variant: "destructive" })
    }
  }

  const confirmDelete = (workflow: Workflow) => {
    setWorkflowToDelete(workflow)
    setIsDeleteOpen(true)
  }

  const openExecuteDialog = (workflow: Workflow) => {
    setSelectedWorkflow(workflow)
    setExecuteInput('{}')
    setIsExecuteOpen(true)
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
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
            <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
            <p className="text-muted-foreground">Orchestrate multi-step AI pipelines</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load workflows</div>
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
            <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
            <p className="text-muted-foreground">Orchestrate multi-step AI pipelines</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Workflows</p>
                <p className="text-2xl font-bold text-foreground">{totalWorkflows}</p>
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
                <p className="text-sm text-muted-foreground">Total Steps</p>
                <p className="text-2xl font-bold text-foreground">
                  {workflows.reduce((sum, w) => sum + w.steps.length, 0)}
                </p>
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
                <p className="text-sm text-muted-foreground">Avg Steps/Workflow</p>
                <p className="text-2xl font-bold text-foreground">
                  {workflows.length > 0
                    ? (workflows.reduce((sum, w) => sum + w.steps.length, 0) / workflows.length).toFixed(1)
                    : '0'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
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
      </div>

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <CardTitle>All Workflows</CardTitle>
          <CardDescription>
            {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredWorkflows.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No workflows found"
              description={workflows.length === 0 ? "Create your first workflow to start orchestrating AI pipelines" : "No workflows match your search"}
              actionLabel={workflows.length === 0 ? "Create Workflow" : undefined}
              onAction={workflows.length === 0 ? () => setIsCreateOpen(true) : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredWorkflows.map((workflow) => (
                <div
                  key={workflow.name}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/workflows/${encodeURIComponent(workflow.name)}`)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20">
                      <GitBranch className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{workflow.name}</h3>
                        <Badge variant="outline">{workflow.steps.length} steps</Badge>
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">
                        Entry: {workflow.entryPoint}
                      </p>
                      {workflow.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(workflow.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/workflows/${encodeURIComponent(workflow.name)}`); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openExecuteDialog(workflow); }}>
                          <Play className="h-4 w-4 mr-2" />
                          Execute
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEstimate(workflow); }}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Estimate Cost
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-500"
                          onClick={(e) => { e.stopPropagation(); confirmDelete(workflow); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Workflow Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Define a multi-step AI pipeline with agent orchestration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name *</Label>
              <Input
                id="name"
                placeholder="e.g., customer-support-pipeline"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="What does this workflow do?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="steps">Steps (JSON) *</Label>
              <Textarea
                id="steps"
                className="h-32 font-mono text-sm"
                placeholder='[{ "id": "step-1", "agent": "my-agent" }]'
                value={formData.stepsJson}
                onChange={(e) => setFormData(prev => ({ ...prev, stepsJson: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Each step needs: id, agent. Optional: next, condition, parallel
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryPoint">Entry Point *</Label>
              <Input
                id="entryPoint"
                placeholder="step-1"
                value={formData.entryPoint}
                onChange={(e) => setFormData(prev => ({ ...prev, entryPoint: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createWorkflow.isPending}>
              {createWorkflow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execute Workflow Dialog */}
      <Dialog open={isExecuteOpen} onOpenChange={setIsExecuteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Workflow</DialogTitle>
            <DialogDescription>
              Run {selectedWorkflow?.name} with input data
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

      {/* Estimate Dialog */}
      <Dialog open={isEstimateOpen} onOpenChange={setIsEstimateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cost Estimate</DialogTitle>
            <DialogDescription>
              Estimated cost for {selectedWorkflow?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {estimateWorkflow.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : estimate ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Estimated Cost</span>
                  <span className="text-2xl font-bold">${estimate.estimatedCost.toFixed(4)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Token Count</span>
                    <span>{estimate.tokenCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Confidence</span>
                    <span>{(estimate.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Based On</span>
                    <span>{estimate.basedOn}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No estimate available
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEstimateOpen(false)}>
              Close
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
              Are you sure you want to delete "{workflowToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWorkflowToDelete(null)}>
              Cancel
            </AlertDialogCancel>
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
