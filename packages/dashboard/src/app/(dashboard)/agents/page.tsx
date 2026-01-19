"use client"

import { Bot, Plus, Search, Filter, MoreVertical, Activity, Clock, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

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
        <Button className="gap-2">
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
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold text-foreground">2</p>
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
          <CardDescription>View and manage all configured AI agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockAgents.map((agent) => (
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
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
