"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bot, Plus, Search, Filter, MoreVertical, Activity, Clock, Zap, X, Loader2, RefreshCw, Trash2, Pause, Play, Eye, Settings } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAgents, useCreateAgent, useDeleteAgent, useUpdateAgent, useMetrics } from "@/hooks"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import type { Agent } from "@/lib/api"

const statusColors = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  running: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  idle: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  error: "bg-red-500/10 text-red-500 border-red-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  timeout: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

// Available models
const AVAILABLE_MODELS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku" },
]

interface CreateAgentFormData {
  name: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

const defaultFormData: CreateAgentFormData = {
  name: "",
  model: "gpt-4",
  systemPrompt: "",
  maxTokens: 4096,
  temperature: 0.7,
}

export default function AgentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [modelFilters, setModelFilters] = useState<string[]>([])
  
  // Dialog states
  const [isNewAgentOpen, setIsNewAgentOpen] = useState(false)
  const [isEditAgentOpen, setIsEditAgentOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [agentToEdit, setAgentToEdit] = useState<Agent | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<CreateAgentFormData>(defaultFormData)
  const [editFormData, setEditFormData] = useState<CreateAgentFormData>(defaultFormData)
  
  // Data fetching
  const { data, isLoading, error, refetch } = useAgents({
    search: searchQuery,
    status: statusFilters,
    model: modelFilters,
  })
  const { data: metrics } = useMetrics()
  const createAgent = useCreateAgent()
  const deleteAgent = useDeleteAgent()
  const updateAgent = useUpdateAgent()
  
  const agents = data?.data || []
  const totalAgents = data?.total || agents.length
  
  // Compute available models from actual data
  const uniqueModels = useMemo(() => {
    const models = new Set(agents.map(a => a.model))
    return Array.from(models)
  }, [agents])
  
  // Stats
  const activeAgentsCount = agents.filter(a => a.status === "running" || a.status === "idle").length
  const avgResponseTime = metrics?.avgResponseTime ? `${metrics.avgResponseTime.toFixed(1)}s` : "N/A"
  const totalTasks = metrics?.totalExecutions24h || 0
  
  // Filter helpers
  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }, [])

  const toggleModelFilter = useCallback((model: string) => {
    setModelFilters(prev => 
      prev.includes(model) 
        ? prev.filter(m => m !== model)
        : [...prev, model]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setStatusFilters([])
    setModelFilters([])
    setSearchQuery("")
  }, [])

  const hasActiveFilters = statusFilters.length > 0 || modelFilters.length > 0
  
  // Handlers
  const handleCreateAgent = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Agent name is required",
        variant: "destructive",
      })
      return
    }
    
    try {
      await createAgent.mutateAsync({
        name: formData.name,
        model: formData.model,
        systemPrompt: formData.systemPrompt,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature,
      })
      
      setIsNewAgentOpen(false)
      setFormData(defaultFormData)
      toast({
        title: "Agent Created",
        description: `${formData.name} has been created successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error Creating Agent",
        description: error instanceof Error ? error.message : "Failed to create agent",
        variant: "destructive",
      })
    }
  }
  
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return
    
    try {
      await deleteAgent.mutateAsync(agentToDelete.id)
      setIsDeleteDialogOpen(false)
      setAgentToDelete(null)
      toast({
        title: "Agent Deleted",
        description: `${agentToDelete.name} has been deleted.`,
      })
    } catch (error) {
      toast({
        title: "Error Deleting Agent",
        description: error instanceof Error ? error.message : "Failed to delete agent",
        variant: "destructive",
      })
    }
  }
  
  const handleViewDetails = (agent: Agent) => {
    router.push(`/agents/${agent.id}`)
  }
  
  const handleViewLogs = (agent: Agent) => {
    router.push(`/logs?agentId=${agent.id}`)
  }
  
  const confirmDelete = (agent: Agent) => {
    setAgentToDelete(agent)
    setIsDeleteDialogOpen(true)
  }

  const openEditDialog = (agent: Agent) => {
    setAgentToEdit(agent)
    setEditFormData({
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.config?.systemPrompt || "",
      maxTokens: agent.config?.maxTokens || 4096,
      temperature: agent.config?.temperature || 0.7,
    })
    setIsEditAgentOpen(true)
  }

  const handleUpdateAgent = async () => {
    if (!agentToEdit) return

    if (!editFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Agent name is required",
        variant: "destructive",
      })
      return
    }

    try {
      await updateAgent.mutateAsync({
        id: agentToEdit.id,
        data: {
          name: editFormData.name,
          model: editFormData.model,
          systemPrompt: editFormData.systemPrompt,
          maxTokens: editFormData.maxTokens,
          temperature: editFormData.temperature,
        },
      })

      setIsEditAgentOpen(false)
      setAgentToEdit(null)
      setEditFormData(defaultFormData)
      toast({
        title: "Agent Updated",
        description: `${editFormData.name} has been updated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error Updating Agent",
        description: error instanceof Error ? error.message : "Failed to update agent",
        variant: "destructive",
      })
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
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Bot className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agents</h1>
            <p className="text-muted-foreground">Manage and configure your AI agents</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-4">Failed to load agents</div>
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
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <Bot className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agents</h1>
            <p className="text-muted-foreground">Manage and configure your AI agents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsNewAgentOpen(true)}>
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search agents..." 
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
                  {statusFilters.length + modelFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuCheckboxItem 
              checked={statusFilters.includes("running")}
              onCheckedChange={() => toggleStatusFilter("running")}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Running
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={statusFilters.includes("idle")}
              onCheckedChange={() => toggleStatusFilter("idle")}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Idle
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={statusFilters.includes("failed")}
              onCheckedChange={() => toggleStatusFilter("failed")}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Failed
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Model</DropdownMenuLabel>
            {uniqueModels.length > 0 ? uniqueModels.map(model => (
              <DropdownMenuCheckboxItem 
                key={model}
                checked={modelFilters.includes(model)}
                onCheckedChange={() => toggleModelFilter(model)}
              >
                {model}
              </DropdownMenuCheckboxItem>
            )) : (
              <DropdownMenuItem disabled className="text-muted-foreground text-sm">
                No models available
              </DropdownMenuItem>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold text-foreground">{activeAgentsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Activity className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold text-foreground">{avgResponseTime}</p>
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
                <p className="text-sm text-muted-foreground">Tasks Today</p>
                <p className="text-2xl font-bold text-foreground">{totalTasks.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Zap className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
          <CardDescription>
            {agents.length === totalAgents 
              ? `${totalAgents} agent${totalAgents !== 1 ? 's' : ''} total`
              : `Showing ${agents.length} of ${totalAgents} agents`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <EmptyState
              preset="agents"
              actionLabel="Create First Agent"
              onAction={() => setIsNewAgentOpen(true)}
            />
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleViewDetails(agent)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20">
                      <Bot className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{agent.name}</h3>
                        <Badge 
                          variant="outline" 
                          className={statusColors[agent.status as keyof typeof statusColors] || statusColors.idle}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {agent.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(agent); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewLogs(agent); }}>
                          <Activity className="h-4 w-4 mr-2" />
                          View Logs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(agent);
                        }}>
                          <Settings className="h-4 w-4 mr-2" />
                          Edit Configuration
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-500 focus:text-red-500"
                          onClick={(e) => { e.stopPropagation(); confirmDelete(agent); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Agent
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

      {/* New Agent Dialog */}
      <Dialog open={isNewAgentOpen} onOpenChange={setIsNewAgentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure a new AI agent for your workflows
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input 
                id="name"
                placeholder="e.g., Customer Support Agent" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select 
                value={formData.model} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea 
                id="systemPrompt"
                className="h-24 resize-none"
                placeholder="Describe the agent's role and behavior..."
                value={formData.systemPrompt}
                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input 
                  id="maxTokens"
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input 
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.7 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewAgentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAgent} disabled={createAgent.isPending}>
              {createAgent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={isEditAgentOpen} onOpenChange={(open) => {
        setIsEditAgentOpen(open)
        if (!open) {
          setAgentToEdit(null)
          setEditFormData(defaultFormData)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update the configuration for {agentToEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Agent Name *</Label>
              <Input
                id="editName"
                placeholder="e.g., Customer Support Agent"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editModel">Model</Label>
              <Select
                value={editFormData.model}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, model: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSystemPrompt">System Prompt</Label>
              <Textarea
                id="editSystemPrompt"
                className="h-24 resize-none"
                placeholder="Describe the agent's role and behavior..."
                value={editFormData.systemPrompt}
                onChange={(e) => setEditFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editMaxTokens">Max Tokens</Label>
                <Input
                  id="editMaxTokens"
                  type="number"
                  value={editFormData.maxTokens}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editTemperature">Temperature</Label>
                <Input
                  id="editTemperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={editFormData.temperature}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.7 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAgentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAgent} disabled={updateAgent.isPending}>
              {updateAgent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAgentToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAgent}
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
