"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Columns2, Trash2, Circle } from "lucide-react"

const logs = [
  { id: "1", level: "info", message: "Agent 'Customer Support' started execution", timestamp: "12:45:32" },
  { id: "2", level: "warning", message: "Rate limit approaching for GPT-4 API", timestamp: "12:44:18" },
  { id: "3", level: "info", message: "Completed 50 token batch processing", timestamp: "12:43:55" },
  { id: "4", level: "error", message: "Failed to connect to external API endpoint", timestamp: "12:42:10" },
  { id: "5", level: "info", message: "Agent 'Data Analysis' completed task #412", timestamp: "12:41:05" },
]

export function LogsPanel() {
  const isConnected = true

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold text-foreground">Logs</CardTitle>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isConnected ? "bg-primary/20 text-primary" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 bg-transparent border-border text-foreground">
                All Levels
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>All Levels</DropdownMenuItem>
              <DropdownMenuItem>Info</DropdownMenuItem>
              <DropdownMenuItem>Warning</DropdownMenuItem>
              <DropdownMenuItem>Error</DropdownMenuItem>
              <DropdownMenuItem>Debug</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent border-border">
            <Columns2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent border-border">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No logs yet</p>
          </div>
        ) : (
          <div className="space-y-2 font-mono text-sm max-h-[280px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{log.timestamp}</span>
                <Circle
                  className={`h-2 w-2 mt-1.5 shrink-0 ${
                    log.level === "error"
                      ? "text-destructive fill-destructive"
                      : log.level === "warning"
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-primary fill-primary"
                  }`}
                />
                <span className="text-foreground/90 flex-1 text-xs leading-relaxed">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
