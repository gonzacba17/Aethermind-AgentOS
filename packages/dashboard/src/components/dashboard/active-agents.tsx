'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Circle, MoreHorizontal, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgents } from "@/hooks"
import { ListSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/hooks/use-toast"

/**
 * Active Agents Component
 * 
 * Displays a list of active agents with their status.
 * Connected to real data via useAgents hook.
 */
export function ActiveAgents() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useAgents({ limit: 4 });

  const agents = data?.data || [];

  const handleViewAll = () => {
    router.push('/agents');
  };

  const handleViewDetails = (agentId: string) => {
    router.push(`/agents/${agentId}`);
  };

  const handleViewLogs = (agentId: string, agentName: string) => {
    toast({
      title: "View Logs",
      description: `Opening logs for ${agentName}`,
    });
    router.push(`/logs?agentId=${agentId}`);
  };

  const handlePauseAgent = (agentId: string, agentName: string) => {
    toast({
      title: "Agent Paused",
      description: `${agentName} has been paused`,
    });
    // TODO: Call API to pause agent
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">Active Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">Active Agents</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-destructive/70 mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load agents</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">Active Agents</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary hover:text-primary/80"
          onClick={handleViewAll}
        >
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.length === 0 ? (
          <EmptyState
            preset="agents"
            actionLabel="Create Agent"
            onAction={() => router.push('/agents')}
          />
        ) : (
          agents.map((agent) => {
            const isActive = agent.status === 'running' || agent.status === 'idle';
            const statusColor = agent.status === 'running' 
              ? 'text-primary fill-primary' 
              : agent.status === 'failed' || agent.status === 'timeout'
              ? 'text-destructive fill-destructive'
              : 'text-muted-foreground fill-muted-foreground';

            return (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                onClick={() => handleViewDetails(agent.id)}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Circle className={`h-2 w-2 ${statusColor}`} />
                    <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{agent.model}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(agent.id); }}>
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewLogs(agent.id, agent.name); }}>
                      View Logs
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); handlePauseAgent(agent.id, agent.name); }}
                      className="text-amber-600"
                    >
                      {agent.status === 'running' ? 'Pause Agent' : 'Start Agent'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
