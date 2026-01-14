import { Card, CardContent } from "@/components/ui/card"
import { Bot, Activity, DollarSign, Coins, TrendingUp, TrendingDown } from "lucide-react"

const stats = [
  {
    title: "Total Agents",
    value: "12",
    subtitle: "3 running",
    icon: Bot,
    trend: "+2",
    trendUp: true,
  },
  {
    title: "Executions",
    value: "1,847",
    subtitle: "Total executions",
    icon: Activity,
    trend: "+124",
    trendUp: true,
  },
  {
    title: "Total Cost",
    value: "$142.50",
    subtitle: "Across all models",
    icon: DollarSign,
    trend: "+$12.30",
    trendUp: false,
  },
  {
    title: "Tokens Used",
    value: "2.4M",
    subtitle: "Total tokens",
    icon: Coins,
    trend: "+320K",
    trendUp: true,
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.title}</span>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold text-foreground">{stat.value}</span>
                <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                  stat.trendUp ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
                )}
              >
                {stat.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {stat.trend}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
