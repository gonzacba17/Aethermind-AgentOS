import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Circle, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

const agents = [
  { id: "1", name: "Customer Support Agent", status: "running", model: "GPT-4", executions: 234 },
  { id: "2", name: "Data Analysis Agent", status: "running", model: "Claude 3", executions: 156 },
  { id: "3", name: "Content Writer Agent", status: "idle", model: "GPT-4", executions: 89 },
  { id: "4", name: "Code Review Agent", status: "running", model: "GPT-4", executions: 412 },
]

export function ActiveAgents() {
  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">Active Agents</CardTitle>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No agents registered yet</p>
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Circle
                    className={`h-2 w-2 ${agent.status === "running" ? "text-primary fill-primary" : "text-muted-foreground fill-muted-foreground"}`}
                  />
                  <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{agent.model}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{agent.executions}</p>
                <p className="text-xs text-muted-foreground">executions</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
