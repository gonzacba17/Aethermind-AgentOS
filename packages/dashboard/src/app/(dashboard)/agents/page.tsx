"use client"

import { useState, useMemo } from "react"
import { Bot, Plus, Search, Filter, MoreVertical, Activity, Clock, Zap, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

const mockAgents = [
  {
    id: "agent-001",
    name: "Customer Support Agent",
    status: "active",
    model: "GPT-4",
    lastActive: "2 min ago",
    tasksCompleted: 1247,
    avgResponseTime: "1.2s",
  },
  {
    id: "agent-002",
    name: "Data Analysis Agent",
    status: "active",
    model: "Claude 3",
    lastActive: "5 min ago",
    tasksCompleted: 892,
    avgResponseTime: "2.8s",
  },
  {
    id: "agent-003",
    name: "Content Writer Agent",
    status: "idle",
    model: "GPT-4",
    lastActive: "1 hour ago",
    tasksCompleted: 456,
    avgResponseTime: "3.5s",
  },
  {
    id: "agent-004",
    name: "Code Review Agent",
    status: "error",
    model: "Claude 3",
    lastActive: "15 min ago",
    tasksCompleted: 234,
    avgResponseTime: "4.1s",
  },
]

const statusColors = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  idle: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  error: "bg-red-500/10 text-red-500 border-red-500/20",
}

export default function AgentsPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [isNewAgentOpen, setIsNewAgentOpen] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [modelFilters, setModelFilters] = useState<string[]>([])

  // Filter agents based on search and filters
  const filteredAgents = useMemo(() => {
    return mockAgents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.model.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(agent.status)
      const matchesModel = modelFilters.length === 0 || modelFilters.includes(agent.model)
      
      return matchesSearch && matchesStatus && matchesModel
    })
  }, [searchQuery, statusFilters, modelFilters])

  const activeAgentsCount = mockAgents.filter(a => a.status === "active").length

  const handleNewAgent = () => {
    setIsNewAgentOpen(false)
    toast({
      title: "Agent Created",
      description: "Your new AI agent has been configured successfully.",
    })
  }

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const toggleModelFilter = (model: string) => {
    setModelFilters(prev => 
      prev.includes(model) 
        ? prev.filter(m => m !== model)
        : [...prev, model]
    )
  }

  const clearFilters = () => {
    setStatusFilters([])
    setModelFilters([])
    setSearchQuery("")
  }

  const hasActiveFilters = statusFilters.length > 0 || modelFilters.length > 0

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
        <Button className="gap-2" onClick={() => setIsNewAgentOpen(true)}>
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
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
              checked={statusFilters.includes("active")}
              onCheckedChange={() => toggleStatusFilter("active")}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active
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
              checked={statusFilters.includes("error")}
              onCheckedChange={() => toggleStatusFilter("error")}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Error
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Model</DropdownMenuLabel>
            <DropdownMenuCheckboxItem 
              checked={modelFilters.includes("GPT-4")}
              onCheckedChange={() => toggleModelFilter("GPT-4")}
            >
              GPT-4
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={modelFilters.includes("Claude 3")}
              onCheckedChange={() => toggleModelFilter("Claude 3")}
            >
              Claude 3
            </DropdownMenuCheckboxItem>
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
                <p className="text-2xl font-bold text-foreground">2.4s</p>
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
                <p className="text-sm text-muted-foreground">Total Tasks Today</p>
                <p className="text-2xl font-bold text-foreground">2,829</p>
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
            {filteredAgents.length === mockAgents.length 
              ? "View and manage all configured AI agents"
              : `Showing ${filteredAgents.length} of ${mockAgents.length} agents`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No agents found matching your criteria</p>
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              </div>
            ) : (
              filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20">
                      <Bot className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{agent.name}</h3>
                        <Badge variant="outline" className={statusColors[agent.status as keyof typeof statusColors]}>
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {agent.model} • Last active {agent.lastActive}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-foreground">{agent.tasksCompleted.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Tasks completed</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-foreground">{agent.avgResponseTime}</p>
                      <p className="text-xs text-muted-foreground">Avg. response</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast({ title: "View Details", description: `Opening details for ${agent.name}` })}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast({ title: "Edit Agent", description: `Editing ${agent.name}` })}>
                          Edit Configuration
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-500"
                          onClick={() => toast({ title: "Agent Stopped", description: `${agent.name} has been stopped` })}
                        >
                          Stop Agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* New Agent Dialog */}
      <Dialog open={isNewAgentOpen} onOpenChange={setIsNewAgentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure a new AI agent for your workflows
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Agent Name</label>
              <Input placeholder="e.g., Customer Support Agent" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Model</label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground">
                <option value="gpt-4">GPT-4</option>
                <option value="claude-3">Claude 3</option>
                <option value="gpt-3.5">GPT-3.5 Turbo</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">System Prompt</label>
              <textarea 
                className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-foreground resize-none"
                placeholder="Describe the agent's role and behavior..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewAgentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewAgent}>
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
